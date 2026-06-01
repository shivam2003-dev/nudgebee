/**
 * @deprecated Runbook functionality has been replaced by Workflows.
 * This file is kept for backward compatibility with existing executions.
 * TODO: Remove once workflow migration is complete.
 */
import apiKubernetes from '@api1/kubernetes';
import { Select } from '@components1/ds/Select';
import { Tabs } from '@components1/ds/Tabs';
import { ExpandMore } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography, CircularProgress } from '@mui/material';
import { Checkbox } from '@components1/ds/Checkbox';
import React, { useEffect, useState } from 'react';
import type { WorkloadObject } from 'src/utils/common';

interface RunbookTargetResourceProps {
  handleChildComponentChange: (value: any, type: string) => void;
  selectedApplications: WorkloadObject[];
  selectedCluster: any;
  selectedNamespace: string | string[];
  reviewRunbook: boolean;
  multipleNamespace?: boolean;
  viewOnlyMode?: boolean;
  hideTabs?: boolean;
}

interface CheckedItems {
  [key: string]: boolean;
}

const RunbookTargetResource: React.FC<RunbookTargetResourceProps> = ({
  handleChildComponentChange,
  selectedApplications,
  selectedCluster,
  selectedNamespace,
  reviewRunbook = false,
  multipleNamespace = false,
  viewOnlyMode = false,
  hideTabs = false,
}) => {
  const targetResourceTypes = [{ id: 'applications', label: 'Applications' }];
  const [targetResourceType, setTargetResourceType] = useState<string>(targetResourceTypes[0].id);
  const [namespaceOption, setNamespaceOption] = useState<string[]>([]);
  const [applications, setApplications] = useState<WorkloadObject[]>([]);
  const [expanded, setExpanded] = React.useState<string | false>(false);
  const [allTargetResource, setAllTargetResource] = useState<boolean>(false);
  const [checkedItems, setCheckedItems] = useState<CheckedItems>({});
  const [isLoadingApplications, setIsLoadingApplications] = useState<boolean>(false);

  useEffect(() => {
    getDropDownData();
  }, []);

  const getDropDownData = async () => {
    try {
      const response: any = await apiKubernetes.getK8sNamespaceNames(selectedCluster?.value);
      const namespaces = response?.data?.namespaces || [];
      setNamespaceOption(namespaces);
    } catch (error) {
      console.error(error);
    }
  };

  const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const handleCheckboxChange = (app: WorkloadObject, isChecked: boolean) => {
    setCheckedItems((prevCheckedItems: { [key: string]: boolean }) => {
      const updatedCheckedItems = { ...prevCheckedItems, [app.name + app.namespace]: isChecked };
      const allChecked = Object.values(updatedCheckedItems).filter((value) => value === true).length;
      if (allChecked === applications?.length) {
        setAllTargetResource(true);
      } else {
        setAllTargetResource(false);
      }
      if (isChecked) {
        handleChildComponentChange(
          JSON.stringify([
            ...selectedApplications,
            {
              type: app.kind,
              name: app.name,
              namespace: app.namespace,
            },
          ]),
          'applications'
        );
        return { ...prevCheckedItems, [app.name + app.namespace]: isChecked };
      }
      handleChildComponentChange(
        JSON.stringify(selectedApplications.filter((ap) => ap.name !== app.name || ap.namespace !== app.namespace)),
        'applications'
      );
      return { ...prevCheckedItems, [app.name + app.namespace]: isChecked };
    });
  };

  const handleSelectAllChange = (isChecked: boolean) => {
    const newCheckedItems: { [key: string]: boolean } = {};
    applications.forEach((app) => {
      newCheckedItems[app.name + app.namespace] = isChecked;
    });
    setCheckedItems(newCheckedItems);
    setAllTargetResource(isChecked);
    if (isChecked) {
      handleChildComponentChange(
        JSON.stringify(applications.map((e) => ({ name: e.name, type: e.kind, namespace: e.namespace }))),
        'all-applications-check'
      );
    } else {
      handleChildComponentChange(JSON.stringify([]), 'all-applications-uncheck');
    }
  };

  useEffect(() => {
    if (Array.isArray(selectedNamespace)) {
      if (selectedNamespace.length > 0 && selectedCluster) {
        handleWorkloadList(selectedNamespace);
      } else {
        setApplications([]);
      }
    } else if (selectedNamespace && selectedCluster) {
      handleWorkloadList(selectedNamespace);
    }
  }, [selectedNamespace, JSON.stringify(selectedCluster)]);

  useEffect(() => {
    if (selectedApplications?.length) {
      const result: { [key: string]: boolean } = selectedApplications.reduce((obj: CheckedItems, item) => {
        obj[item.name + item.namespace] = true;
        return obj;
      }, {});
      setCheckedItems(result);
    } else {
      setCheckedItems({});
      setAllTargetResource(false);
    }
  }, [selectedApplications]);

  const handleWorkloadList = (namespace: string | string[]) => {
    const query = {
      accountId: selectedCluster.value,
      namespaceName: namespace,
      kind: ['Deployment', 'StatefulSet', 'Rollout', 'DaemonSet'],
    };
    setIsLoadingApplications(true);
    apiKubernetes
      .getAllK8sWorkload(query)
      .then((res) => {
        setApplications(res?.data);
      })
      .finally(() => {
        setIsLoadingApplications(false);
      });
  };

  const clusterValue = selectedCluster?.value || '';
  const clusterOptions = selectedCluster ? [{ value: selectedCluster.value, label: selectedCluster.label || selectedCluster.value }] : [];
  const namespaceMultiValue = Array.isArray(selectedNamespace) ? selectedNamespace : selectedNamespace ? [selectedNamespace] : [];
  const namespaceSingleValue = Array.isArray(selectedNamespace) ? selectedNamespace[0] || '' : selectedNamespace || '';

  return (
    <>
      {!hideTabs && <Tabs tabs={targetResourceTypes} value={targetResourceType} onChange={(next) => setTargetResourceType(next)} size='md' />}

      <Box sx={{ mt: '16px' }}>
        <Box sx={{ display: 'flex', gap: '12px', mb: '16px' }}>
          <Box sx={{ minWidth: '230px' }}>
            <Select
              id='select-cluster'
              label='Select Cluster'
              required
              value={clusterValue}
              options={clusterOptions}
              onChange={(next) => handleChildComponentChange(next, 'cluster')}
              disabled={!!selectedCluster || reviewRunbook || viewOnlyMode}
              minWidth='230px'
              placeholder='Select cluster'
            />
          </Box>
          <Box sx={{ minWidth: '230px' }}>
            {multipleNamespace ? (
              <Select
                id='select-namespace'
                label='Select Namespace'
                multiple
                value={namespaceMultiValue}
                options={namespaceOption}
                onChange={(next) => handleChildComponentChange(next, 'namespace')}
                disabled={reviewRunbook || viewOnlyMode}
                minWidth='230px'
                placeholder='Select namespace(s)'
              />
            ) : (
              <Select
                id='select-namespace'
                label='Select Namespace'
                required
                value={namespaceSingleValue}
                options={namespaceOption}
                onChange={(next) => {
                  handleChildComponentChange(next, 'namespace');
                  setApplications([]);
                  setAllTargetResource(false);
                }}
                disabled={!selectedCluster || reviewRunbook || viewOnlyMode}
                minWidth='230px'
                placeholder='Select namespace'
              />
            )}
          </Box>
        </Box>
        <Box>
          <Accordion
            id={'resource-selection-container'}
            className='gray-accordion'
            expanded={expanded === 'target-resources'}
            onChange={handleChange('target-resources')}
            sx={styles.accordion}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Box sx={{ mr: '10px' }} onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    id='total-applications-checkbox'
                    size='sm'
                    checked={allTargetResource}
                    onChange={(next) => handleSelectAllChange(next)}
                    disabled={reviewRunbook || viewOnlyMode}
                    aria-label='Select all applications'
                  />
                </Box>
                <Typography sx={styles.grayLabel}>
                  Total Applications Selected - {Object.keys(checkedItems).filter((key) => checkedItems[key] == true).length}
                </Typography>
              </Box>
              <Box>{isLoadingApplications && <CircularProgress size={15} sx={{ ml: '12px', color: '#807F7F' }} />}</Box>
            </AccordionSummary>

            <AccordionDetails>
              {applications?.length > 0 && (
                <Box display='flex' flexDirection='column' gap='10px'>
                  {applications.map((app, index) => (
                    <Box key={index} display='flex' alignItems='center' gap={'10px'}>
                      <Checkbox
                        id={`${app.name}`}
                        size='sm'
                        checked={checkedItems[app.name + app.namespace] || false}
                        onChange={(next) => handleCheckboxChange(app, next)}
                        disabled={reviewRunbook || viewOnlyMode}
                        aria-label={app.name}
                      />
                      <Box>
                        <Box>
                          <Typography sx={{ fontSize: '13px', fontWeight: 400, color: '#374151' }}>{app.name}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: '11px', fontWeight: 400, color: '#9F9F9F' }}>
                            ns: {app.namespace} | cl: {selectedCluster?.label}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      </Box>
    </>
  );
};

export default RunbookTargetResource;

const styles = {
  lightBlueLabel: {
    padding: '9px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    bgcolor: '#EFF6FF',
    borderRadius: '4px',
    flexGrow: 1,
    mb: '16px',
  },

  numberWithHeading: {
    display: 'grid',
    gridTemplateColumns: '40px 1fr',
    gap: '8px',

    '& .number-heading': {
      height: '40px',
      width: '40px',
      bgcolor: '#BFDBFE',
      borderRadius: '4px',
      fontSize: '16px',
      fontWeight: '600',
      color: '#374151',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },

    '& .main-heading': {
      padding: '9px 16px',
      fontSize: '14px',
      fontWeight: 600,
      color: '#374151',
      bgcolor: '#EFF6FF',
      borderRadius: '4px',
      flexGrow: 1,
      height: '40px',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  },
  grayLabel: {
    color: '#737373',
    fontSize: '12px',
    fontWeight: '500',
  },
  tabButton: {
    width: '180px',
    padding: '8px 12px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textTransform: 'unset',
    borderRadius: '4px',
    bgcolor: '#EFF6FF',
    color: '#374151',
    fontWeight: '400',
    gap: '10px',

    '& img': {
      width: '14px',
      height: '14px',
      objectFit: 'contain',
    },

    '&.active': {
      bgcolor: '#374151',
      color: 'white',
      fontWeight: '500',
    },
  },
  radioButtonsGroup: {
    fontFamily: 'inherit',
    '& .MuiFormControlLabel-label ': { fontSize: '16px', fontFamily: 'inherit', fontWeight: 400, color: '#374151', mr: '40px' },
    '& .MuiRadio-root': {
      p: '8px',
      '& svg': { width: '16px', height: '16px' },
    },
  },
  radioButtonsGroupSmall: {
    fontFamily: 'inherit',
    '& .MuiFormControlLabel-label ': { fontSize: '14px', fontFamily: 'inherit', fontWeight: 500, color: '#374151', mr: '40px' },
    '& .MuiRadio-root': {
      p: '8px',
      '& svg': { width: '16px', height: '16px' },
    },
  },
  grid: {
    display: 'grid',
    gap: '10px',
    gridTemplateColumns: '1fr 36px',
  },
  accordion: {
    border: 'none',
    boxShadow: 'none',
    '& .MuiAccordionSummary-root': {
      bgcolor: '#FEF2F2',
      fontSize: '12px',
      fontWeight: '500',
      color: '#374151',
      padding: '9px 16px',
      minHeight: 'unset',
      borderRadius: '4px',
      border: '0.5px solid #FECACA',

      '&.Mui-expanded': {
        minHeight: 'unset',
        borderRadius: '4px 4px 0px 0px',
      },

      '& .MuiAccordionSummary-content': {
        margin: '0px',
        padding: '0px',
      },
    },

    '&.gray-accordion': {
      '& .MuiAccordionSummary-root': {
        color: '#737373',
        bgcolor: '#F3F3F3',
        border: '0.5px solid #F3F3F3',
      },
    },

    '& .MuiAccordionDetails-root': {
      padding: '12px 24px',
      minHeight: 'unset',
      borderRadius: '0 0 4px 4px',
      border: '0.5px solid #FECACA',
      borderTop: 'none',
      color: '#737373',
      fontSize: '14px',
    },
  },
};
