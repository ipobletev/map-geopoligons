import paramiko
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def transfer_files_scp(host, port, username, password, local_path, remote_path):
    """
    Transfers a file or directory to a remote server via SCP.
    """
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        logger.info(f"Connecting to {host}:{port} as {username}...")
        ssh.connect(host, port=port, username=username, password=password, timeout=10)
        
        sftp = ssh.open_sftp()
        
        if os.path.isfile(local_path):
            filename = os.path.basename(local_path)
            # Ensure remote path ends with separator if it's a directory, or join if it's a full path
            # Simple heuristic: if remote_path looks like a dir (ends with /) or we want to place it inside
            # For simplicity, let's assume remote_path is the destination DIRECTORY
            
            # Check if remote_path is a directory
            try:
                r_stat = sftp.stat(remote_path)
                if str(r_stat).startswith('d'):
                    remote_file_path = os.path.join(remote_path, filename).replace('\\', '/')
                else:
                    # It's a file path?
                    remote_file_path = remote_path
            except FileNotFoundError:
                # Assume it's a directory that needs to be created or a file path
                # Let's try to assume it is a directory first? 
                # Or simply: User provides "Remote Path". If it ends in /, treat as dir.
                if remote_path.endswith('/'):
                     try:
                         sftp.mkdir(remote_path)
                     except:
                         pass
                     remote_file_path = remote_path + filename
                else:
                    remote_file_path = remote_path

            logger.info(f"Uploading {local_path} to {remote_file_path}...")
            sftp.put(local_path, remote_file_path)
            
        else:
            # Directory transfer is more complex, for now let's support single file (zip)
            raise ValueError("Directory transfer not yet supported, please zip first.")

        sftp.close()
        ssh.close()
        return {"status": "success", "message": f"File transferred to {remote_file_path}"}

    except Exception as e:
        logger.error(f"Transfer failed: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        ssh.close()
