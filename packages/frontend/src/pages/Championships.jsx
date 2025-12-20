import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    PlusIcon,
    TrophyIcon,
    MapPinIcon,
    ChevronRightIcon,
    XMarkIcon,
    FlagIcon,
    ClockIcon
} from '@heroicons/react/24/outline'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Championships() {
    const navigate = useNavigate()
    const [championships, setChampionships] = useState([])
    const [tracks, setTracks] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState({ name: '', trackId: '' })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const [champsRes, tracksRes] = await Promise.all([
                fetch(`${API_URL}/api/championships`),
                fetch(`${API_URL}/api/tracks`)
            ])
            const [champsData, tracksData] = await Promise.all([
                champsRes.json(),
                tracksRes.json()
            ])
            setChampionships(champsData.data || [])
            setTracks(tracksData.data || [])
        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!formData.name || !formData.trackId) return

        setSaving(true)
        try {
            const res = await fetch(`${API_URL}/api/championships`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    trackId: formData.trackId,
                    season: new Date().getFullYear().toString(),
                    pointsSystem: '{}'
                })
            })

            if (res.ok) {
                setShowForm(false)
                setFormData({ name: '', trackId: '' })
                loadData()
            }
        } catch (error) {
            console.error('Failed to create championship:', error)
        } finally {
            setSaving(false)
        }
    }

    async function deleteChampionship(id, e) {
        e.stopPropagation()
        if (!confirm('Supprimer ce championnat ?')) return

        try {
            await fetch(`${API_URL}/api/championships/${id}`, { method: 'DELETE' })
            loadData()
        } catch (error) {
            console.error('Failed to delete:', error)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <TrophyIcon className="w-8 h-8 text-yellow-500" />
                        Championnats
                    </h1>
                    <p className="text-gray-600 mt-1">
                        {championships.length} championnat{championships.length > 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium flex items-center gap-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    Nouveau championnat
                </button>
            </div>

            {/* Championships grid */}
            {championships.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl">
                    <TrophyIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600">Aucun championnat</h3>
                    <p className="text-gray-500 mt-1">Créez votre premier championnat</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {championships.map(champ => {
                        const track = tracks.find(t => t.id === champ.trackId)
                        const qualifCount = champ.sessions?.filter(s => s.type === 'qualifying').length || 0
                        const raceCount = champ.sessions?.filter(s => s.type === 'race').length || 0

                        return (
                            <div
                                key={champ.id}
                                onClick={() => navigate(`/championships/${champ.id}`)}
                                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow cursor-pointer group"
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                                <TrophyIcon className="w-6 h-6 text-yellow-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 group-hover:text-yellow-600 transition-colors">
                                                    {champ.name}
                                                </h3>
                                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                                    <MapPinIcon className="w-4 h-4" />
                                                    {track?.name || 'Circuit non défini'}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-yellow-500 transition-colors" />
                                    </div>

                                    <div className="mt-4 flex items-center gap-4">
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <ClockIcon className="w-4 h-4 text-blue-500" />
                                            <span className="text-gray-600">{qualifCount} qualif{qualifCount > 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <FlagIcon className="w-4 h-4 text-green-500" />
                                            <span className="text-gray-600">{raceCount} course{raceCount > 1 ? 's' : ''}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            champ.status === 'active' ? 'bg-green-100 text-green-700' :
                                            champ.status === 'finished' ? 'bg-gray-100 text-gray-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {champ.status === 'active' ? 'En cours' :
                                             champ.status === 'finished' ? 'Terminé' : 'Planifié'}
                                        </span>
                                        <button
                                            onClick={(e) => deleteChampionship(champ.id, e)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Nouveau championnat</h2>
                            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded">
                                <XMarkIcon className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nom du championnat
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Championnat 2024"
                                    className="w-full px-4 py-2 border rounded-lg"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Circuit
                                </label>
                                <select
                                    value={formData.trackId}
                                    onChange={(e) => setFormData(f => ({ ...f, trackId: e.target.value }))}
                                    className="w-full px-4 py-2 border rounded-lg"
                                    required
                                >
                                    <option value="">Sélectionner un circuit...</option>
                                    {tracks.map(track => (
                                        <option key={track.id} value={track.id}>{track.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 disabled:opacity-50"
                                >
                                    {saving ? 'Création...' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
