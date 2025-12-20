export default function CancelConfirmModal({ onClose, onConfirm }) {
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4">Annuler la session ?</h2>
                <p className="text-gray-300 mb-6">Cette action va annuler la session en cours.</p>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl"
                    >
                        Retour
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl"
                    >
                        Annuler la session
                    </button>
                </div>
            </div>
        </div>
    )
}
