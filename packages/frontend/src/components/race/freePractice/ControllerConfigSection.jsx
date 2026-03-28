import { Settings, ChevronUp, ChevronDown, Lock } from 'lucide-react'
import ConfigPanel from '../../config/ConfigPanel'
import ConfigStatus from '../../config/ConfigStatus'

export default function ControllerConfigSection({
    expanded,
    onToggle,
    configs,
    drivers,
    cars,
    onConfigChange,
    configLoading,
    isComplete,
    unconfiguredSlots
}) {
    // Disable editing when onConfigChange is null (e.g. session-specific config)
    const isReadOnly = !onConfigChange
    const isDisabled = configLoading || isReadOnly

    return (
        <div className="bg-white border-b">
            <button
                onClick={onToggle}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50"
            >
                <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-gray-500" />
                    <span className="font-medium text-gray-700">Configuration Pilotes</span>
                    {isReadOnly && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            <Lock className="w-3 h-3" />
                            Session
                        </span>
                    )}
                    <ConfigStatus
                        isComplete={isComplete}
                        unconfiguredCount={unconfiguredSlots.length}
                        unconfiguredSlots={unconfiguredSlots}
                    />
                </div>
                {expanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> :
                    <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>

            {expanded && (
                <div className="px-6 pb-4 border-t bg-gray-50">
                    <div className="pt-4">
                        <ConfigPanel
                            configs={configs.reduce((acc, c) => {
                                acc[c.controller] = c;
                                return acc
                            }, {})}
                            drivers={drivers}
                            cars={cars}
                            onConfigChange={onConfigChange || (() => {})}
                            disabled={isDisabled}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
