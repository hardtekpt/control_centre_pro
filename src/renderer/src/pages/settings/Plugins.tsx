import { useState, useEffect } from 'react'
import { usePluginStore } from '../../stores/pluginStore'
import { PluginGrid } from '../../components/plugins/PluginGrid'
import { ConfigurePage } from '../../components/plugins/ConfigurePage'
import '../../components/plugins/plugins.css'

export function Plugins(): JSX.Element {
  const { plugins, togglePlugin } = usePluginStore()
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null)

  const selectedPlugin = selectedPluginId ? plugins.find((p) => p.id === selectedPluginId) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {selectedPlugin ? (
        <ConfigurePage
          plugin={selectedPlugin}
          onBack={() => setSelectedPluginId(null)}
          onTogglePlugin={togglePlugin}
        />
      ) : (
        <PluginGrid
          plugins={plugins}
          onPluginSelect={setSelectedPluginId}
          onTogglePlugin={togglePlugin}
        />
      )}
    </div>
  )
}
