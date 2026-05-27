import React, { useState } from 'react';
import { Box } from '@mui/material';
import CustomTabs from '@components1/common/CustomTabs';
import LLMConfigList from '@components1/llm/LLMConfigList';
import MCPConfigList from '@components1/llm/MCPConfigList';

/**
 * LLM Configuration tab inside the Nubi Settings modal.
 *
 * Both sub-tabs are read-only listings — full management lives on
 * Admin → Integrations (LLM uses AddLLMConfigModal, MCP uses
 * IntegrationDynamicFormModal). Sub-tabs need no accountId because
 * they neither open a modal nor fetch per-account data (listIntegrations
 * derives the tenant from the session).
 */
const LLMModelConfigurationTab = () => {
  const [activeSubTab, setActiveSubTab] = useState('models');

  return (
    <Box sx={{ py: 2 }}>
      <Box sx={{ mb: 2 }}>
        <CustomTabs
          value={activeSubTab}
          onChange={(val) => setActiveSubTab(val)}
          variant='secondary'
          behavior='filter'
          smallSize
          options={{
            tabOptions: [
              { value: 'models', text: 'LLM Providers' },
              { value: 'mcp', text: 'MCP Servers' },
            ],
          }}
        />
      </Box>

      {activeSubTab === 'models' && <LLMConfigList />}
      {activeSubTab === 'mcp' && <MCPConfigList />}
    </Box>
  );
};

export default LLMModelConfigurationTab;
