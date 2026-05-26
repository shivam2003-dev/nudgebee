import React from 'react';
import PropTypes from 'prop-types';
import SearchIcon from '@mui/icons-material/Search';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import apiAskNudgebee from '@api1/ask-nudgebee';
import CustomTable from '@common-new/tables/CustomTable2';
import CustomLabels from '@common-new/widgets/CustomLabels';
import ExpandableText from '@components1/common/ExpandableText';
import CreateTool from './CreateTool';
import { ListingLayout } from '@components1/ds/ListingLayout';
import { Button as DsButton } from '@components1/ds/Button';
import { Input } from '@components1/ds/Input';
import DownloadButton from '@common-new/DownloadButton';
import { Modal } from '@components1/ds/Modal';
import { hasWriteAccess } from '@lib/auth';
import { useTenantBranding } from '@hooks/useTenantBranding';
import { ErrorIcon } from '@assets';
import SafeIcon from '@components1/common/SafeIcon';
import { snakeToTitleCase } from 'src/utils/common';
import { Box, Tooltip } from '@mui/material';
import { colors } from 'src/utils/colors';
import { TOOL_CONFIGURATION_WARNING } from '@data/constants';

const ListTools = ({ accountId }) => {
  const { baseTitle } = useTenantBranding();
  const [data, setData] = React.useState([]);
  const [originalData, setOriginalData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [createToolModal, setCreateToolModal] = React.useState(false);
  const [allTools, setAllTools] = React.useState([]);
  const [editMode, setEditMode] = React.useState(false);
  const [selectedTool, setSelectedTool] = React.useState(null);
  const [searchToolByName, setSearchToolByName] = React.useState('');

  React.useEffect(() => {
    listTools();
  }, [accountId]);

  React.useEffect(() => {
    if (searchToolByName === '') {
      setData(originalData);
    } else {
      const filteredData = originalData.filter((item) => {
        const originalToolName = item[0].rawData?.name || '';
        const formattedToolName = snakeToTitleCase(originalToolName);
        const searchLower = searchToolByName.toLowerCase();
        return originalToolName.toLowerCase().includes(searchLower) || formattedToolName.toLowerCase().includes(searchLower);
      });
      setData(filteredData);
    }
  }, [searchToolByName, originalData]);

  const handleSearchChange = (next) => {
    setSearchToolByName(next);
  };

  const handleEditTool = (tool) => {
    setSelectedTool(tool);
    setEditMode(true);
    setCreateToolModal(true);
  };

  const listTools = () => {
    setLoading(true);
    apiAskNudgebee
      .listTools({ accountId })
      .then((res) => {
        const listToolsResponse = res?.data?.data?.ai_list_tools?.data ?? [];
        const allTools = listToolsResponse.map((tool) => tool);
        setAllTools(allTools);
        if (listToolsResponse.length > 0) {
          const tools = listToolsResponse.map((tool) => {
            return [
              {
                component: (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Box sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {snakeToTitleCase(tool.name)}
                      {tool.needs_config && !tool.is_configured && (
                        <Tooltip title={TOOL_CONFIGURATION_WARNING}>
                          <SafeIcon src={ErrorIcon} alt='warning' height={18} width={18} />
                        </Tooltip>
                      )}
                    </Box>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: tool.type === 'system' ? colors.background.primaryLightest : colors.background.tertiaryLightest,
                        color: tool.type === 'system' ? colors.text.primary : colors.text.secondary,
                        fontSize: '8px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '12px',
                        border: `1px solid ${tool.type === 'system' ? colors.border.primaryLight : colors.border.secondaryLightest}`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        width: 'fit-content',
                      }}
                    >
                      {tool.type === 'system' ? `${baseTitle} System` : 'User Created'}
                    </Box>
                  </Box>
                ),
                rawData: { name: tool.name },
              },
              {
                text: tool.description ? <ExpandableText text={tool.description} /> : '-',
              },
              {
                component: <CustomLabels text={tool.status} />,
              },
              {
                text: snakeToTitleCase(tool.nb_tool_type),
              },
              {
                component:
                  tool.type === 'custom' && tool.nb_tool_type == 'tool' && hasWriteAccess(accountId) ? (
                    <DsButton
                      tone='secondary'
                      size='xs'
                      composition='icon-only'
                      icon={<EditOutlinedIcon fontSize='small' />}
                      aria-label='Edit tool'
                      onClick={() => handleEditTool(tool)}
                    />
                  ) : null,
              },
            ];
          });
          setData(tools);
          setOriginalData(tools);
        } else {
          setData([]);
          setOriginalData([]);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <>
      <Modal
        width={'md'}
        open={createToolModal}
        handleClose={() => {
          setCreateToolModal(false);
          setEditMode(false);
          setSelectedTool(null);
        }}
        title={editMode ? 'Edit Tool' : 'Add Tool'}
      >
        <CreateTool
          accountId={accountId}
          handleClose={(value) => {
            if (value == 'success') {
              listTools();
            }
            setCreateToolModal(false);
            setEditMode(false);
            setSelectedTool(null);
          }}
          allTools={allTools}
          editMode={editMode}
          toolData={selectedTool}
        />
      </Modal>
      <ListingLayout id='all-tools'>
        <ListingLayout.Toolbar
          actions={
            <>
              <DownloadButton onClick={() => ({ tableId: 'tools' })} />
              <DsButton
                id='integration'
                tone='secondary'
                size='md'
                onClick={() => window.open('/user-management#integrations', '_blank', 'noopener,noreferrer')}
              >
                Integration
              </DsButton>
              {hasWriteAccess(accountId) && (
                <DsButton
                  id='create-tool'
                  tone='primary'
                  size='md'
                  onClick={() => {
                    setEditMode(false);
                    setSelectedTool(null);
                    setCreateToolModal(true);
                  }}
                >
                  Create Tool
                </DsButton>
              )}
            </>
          }
        >
          <Input
            size='sm'
            placeholder='Search Tool'
            value={searchToolByName}
            onChange={handleSearchChange}
            leadingIcon={<SearchIcon fontSize='small' />}
          />
        </ListingLayout.Toolbar>
        <ListingLayout.Body padding={0}>
          <CustomTable
            headers={[
              { name: 'Name', width: '20%' },
              { name: 'Description', width: '40%' },
              { name: 'Status', width: '15%' },
              { name: 'NB Tool Type', width: '15%' },
              { name: 'Actions', width: '10%' },
            ]}
            tableData={data}
            rowsPerPage={data.length}
            totalRows={data.length}
            loading={loading}
            id='tools'
          />
        </ListingLayout.Body>
      </ListingLayout>
    </>
  );
};

ListTools.propTypes = {
  accountId: PropTypes.string,
};

export default ListTools;
