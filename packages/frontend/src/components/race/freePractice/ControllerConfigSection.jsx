import { Cog6ToothIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
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
    return (
        <div className="bg-white border-b">
            <button
                onClick={onToggle}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50"
            >
                <div className="flex items-center gap-3">
                    <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
                    <span className="font-medium text-gray-700">Configuration Controllers</span>
                    <ConfigStatus
                        isComplete={isComplete}
                        unconfiguredCount={unconfiguredSlots.length}
                        unconfiguredSlots={unconfiguredSlots}
                    />
                </div>
                {expanded ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> :
                    <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
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
                            onConfigChange={onConfigChange}
                            disabled={configLoading}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
