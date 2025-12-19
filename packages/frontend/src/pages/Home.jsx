import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { CarreraConnection } from '../utils/carrera-protocol';

export default function Home() {
  const [systemStatus, setSystemStatus] = useState({
    backend: 'checking',
    database: 'checking',
    bluetooth: 'disconnected',
  });

  const [backendInfo, setBackendInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  const socketRef = useRef(null);
  const bleConnectionRef = useRef(null);

  const [simulatorStatus, setSimulatorStatus] = useState({
    running: false,
    active: false,
    raceTime: 0,
    carCount: 0,
  });

  const [carData, setCarData] = useState([]);
  const [connectionMode, setConnectionMode] = useState('none'); // 'none', 'simulator', 'bluetooth'

  const addLog = (type, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { type, message, timestamp }].slice(-50)); // Keep last 50 logs
  };

  useEffect(() => {
    addLog('info', 'RaceHubOS démarré');
    addLog('info', 'Vérification du backend...');

    // Check backend status
    fetch('http://localhost:3000/health')
      .then(res => res.json())
      .then(data => {
        setSystemStatus(prev => ({ ...prev, backend: 'online', database: 'online' }));
        setBackendInfo(data);
        addLog('success', 'Backend connecté: ' + data.version);
        addLog('success', 'Base de données SQLite opérationnelle');

        // Connect WebSocket
        const socket = io('http://localhost:3000');
        socketRef.current = socket;

        socket.on('connect', () => {
          addLog('success', 'WebSocket connecté');
        });

        socket.on('race:status', (status) => {
          setSimulatorStatus(status);
        });

        socket.on('race:carData', (data) => {
          setCarData(data);
        });

        socket.on('race:lap', (data) => {
          addLog('info', `Voiture ${data.carId} - Tour ${data.lapNumber}: ${(data.lapTime / 1000).toFixed(2)}s`);
        });

        socket.on('race:sector', (data) => {
          addLog('info', `Voiture ${data.carId} - Secteur ${data.sector}`);
        });

        socket.on('race:pitStop', (data) => {
          addLog('warning', `Voiture ${data.carId} - Arrêt au stand (${(data.duration / 1000).toFixed(1)}s)`);
        });

        socket.on('disconnect', () => {
          addLog('warning', 'WebSocket déconnecté');
        });
      })
      .catch((error) => {
        setSystemStatus(prev => ({ ...prev, backend: 'offline', database: 'offline' }));
        addLog('error', 'Impossible de se connecter au backend');
        addLog('warning', 'Vérifiez que le backend est lancé sur le port 3000');
      });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const connectBluetooth = async () => {
    try {
      addLog('info', 'Recherche du device Bluetooth AppConnect...');
      setSystemStatus(prev => ({ ...prev, bluetooth: 'connecting' }));

      if (!navigator.bluetooth) {
        addLog('error', 'Web Bluetooth API non disponible');
        addLog('warning', 'Utilisez Chrome ou Edge pour le support Bluetooth');
        alert('Web Bluetooth API non disponible. Utilisez Chrome ou Edge.');
        setSystemStatus(prev => ({ ...prev, bluetooth: 'unavailable' }));
        return;
      }

      // Create BLE connection
      const connection = new CarreraConnection();
      bleConnectionRef.current = connection;

      // Handle incoming events from Control Unit
      connection.onEvent = (event) => {
        if (event.type === 'timer') {
          // Lap or sector event
          addLog('info', `Voiture ${event.carId} - Secteur ${event.sector} - ${event.timestamp}ms`);

          // Emit to backend for processing
          if (socketRef.current) {
            socketRef.current.emit('bluetooth:timer', event);
          }
        } else if (event.type === 'status') {
          // Status update (fuel, pit lanes, etc.)
          addLog('info', `Status reçu - Carburant: ${event.fuel.join(',')}`);

          if (socketRef.current) {
            socketRef.current.emit('bluetooth:status', event);
          }
        }
      };

      // Connect
      const device = await connection.connect();

      addLog('success', `Device trouvé: ${device.name}`);
      addLog('info', 'Connexion au Control Unit...');

      setSystemStatus(prev => ({ ...prev, bluetooth: 'connected' }));
      setConnectionMode('bluetooth');
      addLog('success', 'Connecté au Carrera Control Unit');
      addLog('info', 'Réception des données en temps réel...');

    } catch (error) {
      console.error('Bluetooth error:', error);
      addLog('error', 'Erreur Bluetooth: ' + error.message);
      setSystemStatus(prev => ({ ...prev, bluetooth: 'error' }));

      if (bleConnectionRef.current) {
        await bleConnectionRef.current.disconnect();
        bleConnectionRef.current = null;
      }
    }
  };

  const disconnectBluetooth = async () => {
    if (bleConnectionRef.current) {
      await bleConnectionRef.current.disconnect();
      bleConnectionRef.current = null;
      setSystemStatus(prev => ({ ...prev, bluetooth: 'disconnected' }));
      setConnectionMode('none');
      addLog('warning', 'Bluetooth déconnecté');
    }
  };

  const startSimulator = () => {
    if (socketRef.current) {
      socketRef.current.emit('simulator:start');
      setConnectionMode('simulator');
      addLog('success', 'Simulateur démarré');
    }
  };

  const stopSimulator = () => {
    if (socketRef.current) {
      socketRef.current.emit('simulator:stop');
      setConnectionMode('none');
      addLog('warning', 'Simulateur arrêté');
    }
  };

  const pauseSimulator = () => {
    if (socketRef.current) {
      socketRef.current.emit('simulator:pause');
      addLog('info', simulatorStatus.active ? 'Simulateur en pause' : 'Simulateur repris');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
      case 'connected':
        return 'bg-green-500';
      case 'offline':
      case 'disconnected':
      case 'error':
        return 'bg-red-500';
      case 'checking':
      case 'connecting':
        return 'bg-yellow-500';
      case 'unavailable':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online': return 'En ligne';
      case 'offline': return 'Hors ligne';
      case 'connected': return 'Connecté';
      case 'disconnected': return 'Déconnecté';
      case 'checking': return 'Vérification...';
      case 'connecting': return 'Connexion...';
      case 'error': return 'Erreur';
      case 'unavailable': return 'Non disponible';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
            🏁 RaceHubOS
          </h1>
          <p className="text-xl text-gray-400">
            Open Source Race Management System for Carrera Digital 132/124
          </p>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Backend API</h3>
                <p className="text-gray-400 text-sm">Node.js + Express</p>
              </div>
              <div className={`w-4 h-4 rounded-full ${getStatusColor(systemStatus.backend)} animate-pulse`}></div>
            </div>
            <div className="mt-4">
              <span className={`text-sm font-medium ${systemStatus.backend === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                {getStatusText(systemStatus.backend)}
              </span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Database</h3>
                <p className="text-gray-400 text-sm">SQLite + Prisma</p>
              </div>
              <div className={`w-4 h-4 rounded-full ${getStatusColor(systemStatus.database)} animate-pulse`}></div>
            </div>
            <div className="mt-4">
              <span className={`text-sm font-medium ${systemStatus.database === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                {getStatusText(systemStatus.database)}
              </span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Bluetooth</h3>
                <p className="text-gray-400 text-sm">AppConnect 30369</p>
              </div>
              <div className={`w-4 h-4 rounded-full ${getStatusColor(systemStatus.bluetooth)} animate-pulse`}></div>
            </div>
            <div className="mt-4">
              <span className={`text-sm font-medium ${
                systemStatus.bluetooth === 'connected' ? 'text-green-400' :
                systemStatus.bluetooth === 'error' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {getStatusText(systemStatus.bluetooth)}
              </span>
            </div>
          </div>
        </div>

        {/* Version Info */}
        {backendInfo && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
            <h3 className="text-lg font-semibold mb-4">Informations Système</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Version</p>
                <p className="font-mono text-green-400">{backendInfo.version || '0.1.0'}</p>
              </div>
              <div>
                <p className="text-gray-400">Backend</p>
                <p className="font-mono text-blue-400">Node.js 20+</p>
              </div>
              <div>
                <p className="text-gray-400">Frontend</p>
                <p className="font-mono text-blue-400">React 19 + Vite</p>
              </div>
              <div>
                <p className="text-gray-400">Timestamp</p>
                <p className="font-mono text-gray-300">{new Date(backendInfo.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bluetooth Connection */}
          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
            <h3 className="text-2xl font-semibold mb-4">🔌 Connexion Circuit</h3>
            <p className="text-gray-400 mb-6">
              Connectez le Carrera AppConnect via Bluetooth pour commencer à recevoir les données du circuit.
            </p>

            {connectionMode === 'bluetooth' ? (
              <button
                onClick={disconnectBluetooth}
                className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-lg transition-all active:scale-95"
              >
                Déconnecter
              </button>
            ) : (
              <button
                onClick={connectBluetooth}
                disabled={systemStatus.bluetooth === 'connecting' || connectionMode === 'simulator'}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-lg transition-all ${
                  connectionMode === 'simulator'
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {systemStatus.bluetooth === 'connecting' ? 'Connexion...' :
                 connectionMode === 'simulator' ? 'Simulateur actif' :
                 'Connecter AppConnect'}
              </button>
            )}

            {!navigator.bluetooth && (
              <p className="text-yellow-500 text-sm mt-4">
                ⚠️ Web Bluetooth non supporté. Utilisez Chrome ou Edge.
              </p>
            )}

            {connectionMode === 'bluetooth' && (
              <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded-lg">
                <p className="text-green-400 text-sm">
                  ✓ Connecté en Bluetooth - Données en temps réel
                </p>
              </div>
            )}
          </div>

          {/* Quick Start */}
          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
            <h3 className="text-2xl font-semibold mb-4">🚀 Démarrage Rapide</h3>
            <div className="space-y-3 text-gray-300">
              <div className="flex items-start">
                <span className="text-green-400 mr-3">1.</span>
                <p>Connectez l'AppConnect au circuit</p>
              </div>
              <div className="flex items-start">
                <span className="text-green-400 mr-3">2.</span>
                <p>Cliquez sur "Connecter AppConnect"</p>
              </div>
              <div className="flex items-start">
                <span className="text-green-400 mr-3">3.</span>
                <p>Configurez vos pilotes et voitures</p>
              </div>
              <div className="flex items-start">
                <span className="text-green-400 mr-3">4.</span>
                <p>Lancez votre première course !</p>
              </div>
            </div>
            <button className="w-full mt-6 py-3 px-6 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold text-lg transition-all active:scale-95">
              Configurer une course →
            </button>
          </div>
        </div>

        {/* Simulator Controls */}
        <div className="mt-8 bg-gray-800 rounded-lg p-8 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-semibold">🎮 Simulateur de Course</h3>
              <p className="text-gray-400 text-sm mt-1">
                Testez le système sans matériel Carrera
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Mode</div>
              <div className={`text-lg font-semibold ${
                connectionMode === 'bluetooth' ? 'text-blue-400' :
                connectionMode === 'simulator' ? 'text-green-400' :
                'text-gray-500'
              }`}>
                {connectionMode === 'bluetooth' ? '📡 Bluetooth' :
                 connectionMode === 'simulator' ? (simulatorStatus.active ? '▶ Simulateur' : '⏸ Pause') :
                 '⏹ Aucun'}
              </div>
            </div>
          </div>

          {connectionMode === 'bluetooth' && (
            <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <p className="text-blue-400 text-sm">
                ℹ️ Simulateur désactivé - Connexion Bluetooth active
              </p>
            </div>
          )}

          <div className="flex gap-4 mb-6">
            <button
              onClick={startSimulator}
              disabled={simulatorStatus.running || connectionMode === 'bluetooth'}
              className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ▶ Démarrer
            </button>
            <button
              onClick={pauseSimulator}
              disabled={!simulatorStatus.running || connectionMode === 'bluetooth'}
              className="flex-1 py-3 px-6 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {simulatorStatus.active ? '⏸ Pause' : '▶ Reprendre'}
            </button>
            <button
              onClick={stopSimulator}
              disabled={!simulatorStatus.running || connectionMode === 'bluetooth'}
              className="flex-1 py-3 px-6 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ⏹ Arrêter
            </button>
          </div>

          {/* Race Info */}
          {simulatorStatus.running && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-900 rounded-lg">
              <div>
                <div className="text-gray-400 text-sm">Temps de course</div>
                <div className="text-xl font-mono text-green-400">
                  {Math.floor(simulatorStatus.raceTime / 60000)}:{String(Math.floor((simulatorStatus.raceTime % 60000) / 1000)).padStart(2, '0')}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Voitures</div>
                <div className="text-xl font-mono text-blue-400">{simulatorStatus.carCount}</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Tours total</div>
                <div className="text-xl font-mono text-purple-400">
                  {carData.reduce((sum, car) => sum + car.totalLaps, 0)}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Leader</div>
                <div className="text-xl font-mono text-yellow-400">
                  Voiture {carData.find(c => c.position === 1)?.id || '-'}
                </div>
              </div>
            </div>
          )}

          {/* Car Data Table */}
          {carData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-400 font-semibold">Pos</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-semibold">Voiture</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-semibold">Tours</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-semibold">Dernier tour</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-semibold">Meilleur</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-semibold">Carburant</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-semibold">Vitesse</th>
                  </tr>
                </thead>
                <tbody>
                  {carData.sort((a, b) => a.position - b.position).map((car) => (
                    <tr key={car.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                      <td className="py-2 px-3 font-semibold">{car.position}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center ${car.inPit ? 'text-yellow-400' : ''}`}>
                          Voiture {car.id}
                          {car.inPit && <span className="ml-2 text-xs">🔧 PIT</span>}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{car.totalLaps}</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {car.lastLapTime > 0 ? `${(car.lastLapTime / 1000).toFixed(2)}s` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-green-400">
                        {car.bestLapTime ? `${(car.bestLapTime / 1000).toFixed(2)}s` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${car.fuel > 5 ? 'bg-green-500' : car.fuel > 2 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${(car.fuel / 15) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-mono w-8">{car.fuel}/15</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{car.speed}/15</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
            <div className="text-4xl mb-3">📊</div>
            <h4 className="font-semibold mb-2">Tableau de Score</h4>
            <p className="text-sm text-gray-400">Positions et temps en temps réel</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
            <div className="text-4xl mb-3">👤</div>
            <h4 className="font-semibold mb-2">Gestion Pilotes</h4>
            <p className="text-sm text-gray-400">Profils, stats et historique</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
            <div className="text-4xl mb-3">🏆</div>
            <h4 className="font-semibold mb-2">Championnats</h4>
            <p className="text-sm text-gray-400">Classements et points</p>
          </div>
        </div>

        {/* System Logs */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">📋 Logs Système</h3>
            <button
              onClick={() => setLogs([])}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Effacer
            </button>
          </div>
          <div className="bg-black rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Aucun log pour le moment...
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'warning' ? 'text-yellow-400' :
                      log.type === 'success' ? 'text-green-400' :
                      'text-gray-300'
                    }`}
                  >
                    <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                    <span className="font-semibold uppercase text-xs">
                      {log.type === 'error' ? '[ERROR]' :
                       log.type === 'warning' ? '[WARN]' :
                       log.type === 'success' ? '[OK]' :
                       '[INFO]'}
                    </span>{' '}
                    {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>RaceHubOS - Open Source • Apache-2.0 License</p>
          <p className="mt-2">Made with ❤️ for Carrera Digital 132/124</p>
        </div>
      </div>
    </div>
  );
}
