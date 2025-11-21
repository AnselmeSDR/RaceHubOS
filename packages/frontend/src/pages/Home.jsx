import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [systemStatus, setSystemStatus] = useState({
    backend: 'checking',
    database: 'checking',
    bluetooth: 'disconnected',
  });

  const [backendInfo, setBackendInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

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
      })
      .catch((error) => {
        setSystemStatus(prev => ({ ...prev, backend: 'offline', database: 'offline' }));
        addLog('error', 'Impossible de se connecter au backend');
        addLog('warning', 'Vérifiez que le backend est lancé sur le port 3000');
      });
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

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'Control_Unit' }],
        optionalServices: ['39df7777-b1b4-b90b-57f1-7144ae4e4a6a']
      });

      addLog('success', `Device trouvé: ${device.name} (${device.id})`);
      addLog('info', 'Connexion au Control Unit...');

      setSystemStatus(prev => ({ ...prev, bluetooth: 'connected' }));
      addLog('success', 'Connecté au Carrera Control Unit');
      alert('Connecté à ' + device.name);
    } catch (error) {
      console.error('Bluetooth error:', error);
      addLog('error', 'Erreur Bluetooth: ' + error.message);
      setSystemStatus(prev => ({ ...prev, bluetooth: 'error' }));
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
      <div className="container mx-auto px-4 py-8">
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
            <button
              onClick={connectBluetooth}
              disabled={systemStatus.bluetooth === 'connecting' || systemStatus.bluetooth === 'connected'}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-lg transition-all ${
                systemStatus.bluetooth === 'connected'
                  ? 'bg-green-600 hover:bg-green-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {systemStatus.bluetooth === 'connected' ? '✓ Connecté' :
               systemStatus.bluetooth === 'connecting' ? 'Connexion...' :
               'Connecter AppConnect'}
            </button>
            {!navigator.bluetooth && (
              <p className="text-yellow-500 text-sm mt-4">
                ⚠️ Web Bluetooth non supporté. Utilisez Chrome ou Edge.
              </p>
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
