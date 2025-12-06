import threading
import time
import json
import numpy as np

try:
    import rospy
    from std_msgs.msg import Bool, String, Int32
    from sensor_msgs.msg import NavSatFix, PointCloud2, Imu
    from geometry_msgs.msg import PoseWithCovarianceStamped, TransformStamped
    from zeus_37_msgs.msg import Zeus37Info, PrimerInfo
    from enaex_msgs.msg import DrillHoles, ChangeDrillHoleStatus, Gpgga, DrillHoleStatus
    from amtc_behavior_control_msgs.msg import OperatorControl, BehaviorControlStatus
    from enaex_srvs.srv import GetOperatorFeedback, GetOperatorFeedbackResponse
    ROS_AVAILABLE = True
except ImportError:
    ROS_AVAILABLE = False
    print("ROS not available, running in mock mode")

class RosManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RosManager, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        if self.initialized:
            return
        
        self.initialized = True
        self.lock = threading.Lock()
        
        # State Data
        self.machine_data = {
            "speed": 0.0,
            "rpm": 0.0,
            "fuel": 0.0,
            "voltage": 0.0,
            "machine_on": False,
            "machine_operative": False,
            "dieci_status": False,
            "dieci_alarm": False,
            "mode_autonomous": False,
            "mode_manual": False
        }
        
        self.sensors_status = {
            "lidar_front": "ok", "lidar_left": "ok", "lidar_right": "ok", "lidar_back": "ok",
            "imu_front": "ok", "imu_left": "ok", "imu_right": "ok", "imu_back": "ok",
            "gnss": "ok"
        }
        
        self.primer_info = {
            "spooler_right": 0, "spooler_left": 0,
            "booster_right": 0, "booster_left": 0,
            "stick_count": 0,
            "racks": []
        }
        
        self.inclination = {
            "primer": 0.0,
            "dieci": 0.0
        }
        
        self.mission_state = "idle"
        self.operator_request = None
        self.operator_options = []
        self.drillhole_stats = {"total": 0, "completed": 0, "water": 0}
        
        self.waiting_operator_answer = False
        self.operator_answer_index = -1

        # Log buffers
        self.info_logs = []
        self.warn_logs = []
        self.danger_logs = []
        
        if ROS_AVAILABLE:
            threading.Thread(target=self.init_ros, daemon=True).start()

    def init_ros(self):
        rospy.init_node('web_wizard_gui', anonymous=True)
        
        # Publishers
        self.pub_operator_control = rospy.Publisher('/gui_operator_control', OperatorControl, queue_size=10)
        self.pub_abort_mission = rospy.Publisher('/abort_mission', String, queue_size=10)
        self.pub_machine_on = rospy.Publisher('/machine_on', Bool, queue_size=10)
        self.pub_machine_operative = rospy.Publisher('/machine_operative', Bool, queue_size=10)
        self.pub_skip_drillhole = rospy.Publisher('/skip_drillhole', ChangeDrillHoleStatus, queue_size=10)
        
        # Subscribers
        rospy.Subscriber('/zeus_37_info', Zeus37Info, self.machine_data_callback)
        rospy.Subscriber('/primer_info', PrimerInfo, self.primer_data_callback)
        rospy.Subscriber('/GUI/warn_message', String, self._warn_callback)
        rospy.Subscriber('/GUI/gui_info', String, self._info_callback)
        # Add other subscribers as needed...
        
        # Service
        self.service = rospy.Service('/HIGHLEVEL/behavior_control/get_operator_feedback', GetOperatorFeedback, self.handle_operator_feedback)
        
        rospy.spin()

    def _warn_callback(self, msg):
        with self.lock:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            self.warn_logs.append(f"{timestamp}: {msg.data}")
            if len(self.warn_logs) > 50:
                self.warn_logs.pop(0)

    def _info_callback(self, msg):
        with self.lock:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            self.info_logs.append(f"{timestamp}: {msg.data}")
            if len(self.info_logs) > 50:
                self.info_logs.pop(0)

    def machine_data_callback(self, data):
        with self.lock:
            self.machine_data["speed"] = data.speed
            self.machine_data["rpm"] = data.rpm
            self.machine_data["fuel"] = data.fuel_level
            self.machine_data["voltage"] = data.main_battery_voltage
            self.machine_data["machine_on"] = data.machine_on_status
            self.machine_data["machine_operative"] = data.machine_operative_indicator
            self.machine_data["mode_autonomous"] = data.mode_op_autonomous
            self.machine_data["mode_manual"] = data.mode_op_manual
            self.inclination["dieci"] = data.machine_pitch
            self.inclination["primer"] = data.primer_pitch

            # Check for emergency stops to populate danger logs
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            if data.in_ros_emergency_stop:
                 self._add_danger_log(f"{timestamp}: ROS Emergency Stop Active (Code: {data.emergency_stop_code})")
            if data.estop_rc:
                 self._add_danger_log(f"{timestamp}: RC Emergency Stop Active")
            if data.estop_dieci:
                 self._add_danger_log(f"{timestamp}: Dieci Emergency Stop Active")
            if data.estop_remote_dieci:
                 self._add_danger_log(f"{timestamp}: Remote Dieci Emergency Stop Active")

    def _add_danger_log(self, msg):
        # Avoid spamming the same log
        if not self.danger_logs or self.danger_logs[-1] != msg:
            self.danger_logs.append(msg)
            if len(self.danger_logs) > 50:
                self.danger_logs.pop(0)

    def primer_data_callback(self, data):
        with self.lock:
            self.primer_info["spooler_right"] = data.spooler_count_right
            self.primer_info["spooler_left"] = data.spooler_count_left
            self.primer_info["booster_right"] = data.booster_count_right
            self.primer_info["booster_left"] = data.booster_count_left
            self.primer_info["stick_count"] = data.stick_count

    def handle_operator_feedback(self, req):
        # Map request ID to text/options (simplified for now)
        request_map = {
            0: ("Drillhole not found. What to do?", ["Retry", "Skip", "Manual"]),
            1: ("Fine positioning error.", ["Retry", "Skip"]),
            # ... add other mappings based on autonomous_manager.py
        }
        
        msg, options = request_map.get(req.feedback_request, ("Unknown Request", ["OK"]))
        
        with self.lock:
            self.operator_request = msg
            self.operator_options = options
            self.waiting_operator_answer = True
            self.operator_answer_index = -1
        
        # Wait for answer
        while self.waiting_operator_answer and not rospy.is_shutdown():
            time.sleep(0.1)
            
        resp = GetOperatorFeedbackResponse()
        resp.feedback_response = self.operator_answer_index
        return resp

    def get_supervision_data(self):
        with self.lock:
            return self.machine_data.copy()

    def get_logs(self):
        with self.lock:
            return {
                "info": list(reversed(self.info_logs)),
                "warn": list(reversed(self.warn_logs)),
                "danger": list(reversed(self.danger_logs))
            }

    def get_status_data(self):
        with self.lock:
            return {
                "sensors": self.sensors_status,
                "primer": self.primer_info,
                "inclination": self.inclination
            }

    def get_autonomous_data(self):
        with self.lock:
            return {
                "missionState": self.mission_state,
                "operatorRequest": self.operator_request,
                "operatorOptions": self.operator_options,
                "drillholeStats": self.drillhole_stats
            }

    def set_machine_on(self, state):
        if ROS_AVAILABLE:
            self.pub_machine_on.publish(Bool(data=state))

    def set_machine_operative(self, state):
        if ROS_AVAILABLE:
            self.pub_machine_operative.publish(Bool(data=state))

    def send_mission_command(self, command):
        if not ROS_AVAILABLE:
            return
            
        if command == 'start':
            msg = OperatorControl()
            msg.requested_mission = 'gui_level_probe_skipnoholes_v2' # Default mission
            self.pub_operator_control.publish(msg)
            self.mission_state = "running"
        elif command == 'abort':
            self.pub_abort_mission.publish(String(data="abort"))
            self.mission_state = "idle"
        elif command == 'home':
            msg = OperatorControl()
            msg.requested_mission = 'go_home'
            self.pub_operator_control.publish(msg)
        elif command == 'only_primer':
            msg = OperatorControl()
            msg.requested_mission = 'only_primer'
            self.pub_operator_control.publish(msg)

    def set_operator_answer(self, answer_index):
        with self.lock:
            self.operator_answer_index = answer_index
            self.waiting_operator_answer = False
            self.operator_request = None
            self.operator_options = []

ros_manager = RosManager()
