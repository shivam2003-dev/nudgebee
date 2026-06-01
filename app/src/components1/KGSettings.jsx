import { useEffect, useMemo, useState } from 'react';
import { Box, Divider, Typography } from '@mui/material';
import PropTypes from 'prop-types';
import { Modal } from '@components1/common/modal';
import CustomCheckBox from '@components1/common/CustomCheckbox';
import CustomButton from '@components1/common/NewCustomButton';
import CustomSearch from '@common-new/CustomSearch';
import { snackbar } from '@components1/common/snackbarService';
import apiKubernetes1 from '@api1/kubernetes1';
import { colors } from 'src/utils/colors';

const FLOW_SOURCES = [
  { id: 'ebpf', label: 'eBPF' },
  { id: 'traces', label: 'Traces' },
  { id: 'datadog-apm', label: 'Datadog APM' },
  { id: 'newrelic-apm', label: 'New Relic APM' },
];

const KGSettings = ({ open, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cloudAccounts, setCloudAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState(new Set());
  const [selectedFlowSources, setSelectedFlowSources] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSearchTerm('');

    Promise.all([apiKubernetes1.knowledgeGraphCloudAccounts(), apiKubernetes1.knowledgeGraphTenantFilter()])
      .then(([accountsRes, filterRes]) => {
        if (cancelled) {
          return;
        }
        const rows = accountsRes?.data?.data?.cloud_accounts?.rows ?? [];
        // Newest-first: rows without created_at sink to the bottom so they
        // don't masquerade as recent.
        const accounts = [...rows].sort((a, b) => {
          const ta = a.created_at ? Date.parse(a.created_at) : 0;
          const tb = b.created_at ? Date.parse(b.created_at) : 0;
          return tb - ta;
        });
        const filter = filterRes?.data?.data?.kg_get_tenant_filter ?? null;

        setCloudAccounts(accounts);

        if (filter?.exists) {
          setSelectedAccountIds(new Set(filter.account_ids ?? []));
          setSelectedFlowSources(new Set(filter.flow_sources ?? []));
        } else {
          // No row yet: pre-select everything so save with no changes is a no-op.
          setSelectedAccountIds(new Set(accounts.map((a) => a.id)));
          setSelectedFlowSources(new Set(FLOW_SOURCES.map((f) => f.id)));
        }
      })
      .catch((err) => {
        console.error('Failed to load KG settings:', err);
        snackbar.error('Failed to load Knowledge Graph settings.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredAccounts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      return cloudAccounts;
    }
    return cloudAccounts.filter((acc) =>
      [acc.account_name, acc.account_number, acc.cloud_provider, acc.id].some((field) => (field || '').toString().toLowerCase().includes(q))
    );
  }, [cloudAccounts, searchTerm]);

  const toggle = (set, id) => {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiKubernetes1.knowledgeGraphUpsertTenantFilter({
        accountIds: Array.from(selectedAccountIds),
        flowSources: Array.from(selectedFlowSources),
      });
      const errors = res?.data?.errors;
      if (errors?.length) {
        snackbar.error(`Failed to save Knowledge Graph settings: ${errors[0]?.message ?? 'Unknown error'}`);
        return;
      }
      const data = res?.data?.data?.kg_upsert_tenant_filter;
      const removedAcc = data?.removed_accounts?.length || 0;
      const removedFs = data?.removed_flow_sources?.length || 0;
      if (removedAcc || removedFs) {
        snackbar.success(
          `Settings saved. Removed items deactivated immediately (${removedAcc} account${removedAcc === 1 ? '' : 's'}, ${removedFs} flow source${
            removedFs === 1 ? '' : 's'
          }). Newly enabled items appear after the next nightly rebuild.`
        );
      } else {
        snackbar.success('Knowledge Graph settings saved. Newly enabled items appear after the next nightly rebuild.');
      }
      onSaved?.();
    } catch (err) {
      console.error('Failed to save KG settings:', err);
      snackbar.error('Failed to save Knowledge Graph settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title='Knowledge Graph Settings'
      width='sm'
      loader={loading}
      actionButtons={
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: '12px 24px' }}>
          <CustomButton id='kg-settings-cancel-btn' text='Cancel' variant='secondary' size='Medium' onClick={onClose} disabled={saving} />
          <CustomButton
            id='kg-settings-save-btn'
            text={saving ? 'Saving…' : 'Save'}
            variant='primary'
            size='Medium'
            onClick={handleSave}
            disabled={saving || loading}
          />
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2 }}>
        <Typography sx={{ fontSize: '12px', color: colors.text.secondaryDark }}>
          Choose which cloud accounts and flow sources feed the Knowledge Graph. Removed items disappear from the graph immediately. Newly enabled
          items appear after the next nightly rebuild.
        </Typography>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: colors.text.secondary }}>Cloud accounts</Typography>
            {cloudAccounts.length > 0 && (
              <CustomSearch
                id='kg-settings-account-search'
                label='Search accounts'
                value={searchTerm}
                onChange={setSearchTerm}
                minWidth='180px'
                maxWidth='220px'
              />
            )}
          </Box>
          {cloudAccounts.length === 0 ? (
            <Typography sx={{ fontSize: '12px', color: colors.text.secondaryDark, fontStyle: 'italic' }}>
              No active cloud accounts configured for this tenant.
            </Typography>
          ) : filteredAccounts.length === 0 ? (
            <Typography sx={{ fontSize: '12px', color: colors.text.secondaryDark, fontStyle: 'italic' }}>
              No accounts match &ldquo;{searchTerm}&rdquo;.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: '260px', overflowY: 'auto' }}>
              {filteredAccounts.map((acc) => (
                <Box
                  key={acc.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    '&:hover': { backgroundColor: colors.background.tertiaryLightest },
                  }}
                >
                  <CustomCheckBox
                    id={`kg-settings-account-${acc.id}`}
                    checked={selectedAccountIds.has(acc.id)}
                    text={acc.account_name || acc.account_number || acc.id}
                    onChange={() => setSelectedAccountIds((s) => toggle(s, acc.id))}
                  />
                  <Typography sx={{ fontSize: '11px', color: colors.text.secondaryDark }}>
                    {acc.cloud_provider}
                    {acc.account_number ? ` · ${acc.account_number}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Divider />

        <Box>
          <Typography sx={{ fontSize: '14px', fontWeight: 600, color: colors.text.secondary, mb: 1 }}>Flow sources</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {FLOW_SOURCES.map((fs) => (
              <CustomCheckBox
                key={fs.id}
                id={`kg-settings-flow-${fs.id}`}
                checked={selectedFlowSources.has(fs.id)}
                text={fs.label}
                onChange={() => setSelectedFlowSources((s) => toggle(s, fs.id))}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

KGSettings.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
};

export default KGSettings;
