import { XMarkIcon, PlayIcon } from '@heroicons/react/24/outline'

export default function QualifyingModal({
    form,
    setForm,
    championships,
    onClose,
    onStart
}) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Qualifications</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <XMarkIcon className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom (optionnel)</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Qualifications"
                            className="w-full px-4 py-2 border rounded-lg"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Durée (min)</label>
                            <input
                                type="number"
                                min="0"
                                value={form.duration}
                                onChange={(e) => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tours max</label>
                            <input
                                type="number"
                                min="0"
                                value={form.maxLaps}
                                onChange={(e) => setForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 0 }))}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Championnat</label>
                        <select
                            value={form.championshipId || ''}
                            onChange={(e) => setForm(f => ({ ...f, championshipId: e.target.value || null }))}
                            className="w-full px-4 py-2 border rounded-lg"
                        >
                            <option value="">Aucun</option>
                            {championships.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annuler
                    </button>
                    <button onClick={onStart}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                        <PlayIcon className="w-5 h-5" />
                        Démarrer
                    </button>
                </div>
            </div>
        </div>
    )
}
