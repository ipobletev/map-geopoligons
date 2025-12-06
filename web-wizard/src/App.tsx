import Wizard from './components/Wizard';
import RouteGenerator from './components/RouteGenerator';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto space-y-8">
        <Wizard />
        <RouteGenerator />
      </div>
    </div>
  );
}

export default App;
