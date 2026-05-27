import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Stack,
  Typography,
  TextField,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
  Autocomplete,
  Chip,
  Divider,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Modal } from '@components1/common/modal';
import CustomButton from '@components1/common/NewCustomButton';
import { snackbar } from '@components1/common/snackbarService';
import apiUser from '@api1/user';
import apiIntegrations from '@api1/integrations';
import apiAskNudgebee from '@api1/ask-nudgebee';
import { ENCRYPTED_MASK } from '@api1/integrations/helpers';

const PROVIDERS = ['anthropic', 'azure', 'bedrock', 'googleai', 'huggingface', 'openai', 'sagemaker', 'vertexai'];

const TIER_KEYS = ['reasoning', 'retrieval', 'summary'];

const TIER_LABELS = {
  reasoning: 'Reasoning',
  retrieval: 'Retrieval',
  summary: 'Summary',
};

const TIER_HINTS = {
  reasoning: 'Heavy investigation + critique. Highest-quality model recommended.',
  retrieval: 'Query / search generation. Fast / cheap model recommended.',
  summary: 'Summarisation, memory, acknowledgments. Fast / cheap model recommended.',
};

const emptyConfig = () => ({ model: '', fallbacks: '' });

/**
 * Custom Add/Edit modal for the LLM Configuration. Writes flat config keys
 * into the LLM integration record (no JSON blob):
 *
 *   Global:       llm_provider, llm_model_name, llm_model_fallbacks
 *   Per tier:     llm_tier_provider_<tier>, llm_tier_model_<tier>,
 *                 llm_tier_model_fallbacks_<tier>
 *                 (provider is inherited from global; we still write it
 *                 because the resolver's tier layer requires both
 *                 provider+model to fire)
 *   Per agent:    llm_provider_<agent>, llm_model_name_<agent>,
 *                 llm_model_fallbacks_<agent>
 *
 * The api-server LLM schema needs entries for the tier and per-agent keys
 * for saves to validate — that's a follow-up. The modal renders correctly
 * regardless.
 */

// Text field for secret values (API key, AWS access/secret). Renders as
// password-typed by default with an eye-icon toggle to reveal. When the
// form is in edit mode the field starts with `ENCRYPTED_MASK` as its
// displayed value; clicking the eye while the mask is shown replaces the
// mask with `originalValue` (the actual plaintext / ciphertext that the
// form loaded) so the user can verify or copy it.
const MaskedSecretField = ({ label, value, onChange, originalValue, helperText, required }) => {
  const [show, setShow] = useState(false);
  const handleToggle = () => {
    if (!show && value === ENCRYPTED_MASK && originalValue) {
      onChange(originalValue);
    }
    setShow(!show);
  };
  return (
    <TextField
      label={label}
      size='small'
      type={show ? 'text' : 'password'}
      autoComplete='new-password'
      value={value}
      onChange={(e) => onChange(e.target.value)}
      helperText={helperText}
      required={required}
      InputProps={{
        endAdornment: (
          <InputAdornment position='end'>
            <IconButton size='small' onClick={handleToggle} tabIndex={-1} aria-label={show ? 'Hide value' : 'Show value'}>
              {show ? <VisibilityOffIcon fontSize='small' /> : <VisibilityIcon fontSize='small' />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
};

MaskedSecretField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  originalValue: PropTypes.string,
  helperText: PropTypes.string,
  required: PropTypes.bool,
};

const AddLLMConfigModal = ({ open, onClose, editData, onSaved, accountId }) => {
  const isEdit = !!editData?.id;

  // Account multi-select.
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);

  // Agent list — fetched dynamically from llm-server's registered agents so
  // the dropdown stays in sync without enumerating agents in Go or
  // hardcoding them in the frontend.
  const [knownAgents, setKnownAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Global fields.
  const [configName, setConfigName] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [fallbacks, setFallbacks] = useState('');

  // Provider-specific credentials (shape mirrors integrations/llm.go schema —
  // see ShowWhen/RequiredWhen rules there for each field's provider mapping).
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiVersion, setApiVersion] = useState('');
  const [region, setRegion] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [apiType, setApiType] = useState('');
  const [adapterId, setAdapterId] = useState('');
  const [requireAdapterId, setRequireAdapterId] = useState('');

  // Stash the original encrypted values from the loaded integration. When the
  // user keeps the mask in the input, we substitute the original ciphertext
  // back on save/test (matching IntegrationDynamicFormModal:580-586). Without
  // this, sending the literal mask string trips the backend's hex-decrypt.
  const [originalSecrets, setOriginalSecrets] = useState({});

  // Per-tier fields (just model + fallbacks; provider inherited from global).
  const [tiers, setTiers] = useState({
    reasoning: emptyConfig(),
    retrieval: emptyConfig(),
    summary: emptyConfig(),
  });

  // Per-agent overrides — array of { agent, model, fallbacks } rows.
  const [agentRows, setAgentRows] = useState([]);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Load the cloud-account list once when the modal opens.
  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setAccountsLoading(true);
        const res = await apiUser.listAccounts();
        if (cancelled) {
          return;
        }
        if (!Array.isArray(res)) {
          // listAccounts has historically returned [] on error rather than
          // throwing. Surface the empty-on-failure case so the operator
          // notices rather than seeing a silently empty dropdown.
          snackbar.error('Failed to load cloud accounts');
          return;
        }
        setAccounts(res.map((a) => ({ id: a.id, name: a.account_name })));
      } catch (err) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error('AddLLMConfigModal: listAccounts failed', err);
          snackbar.error('Failed to load cloud accounts');
        }
      } finally {
        if (!cancelled) {
          setAccountsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Fetch the dynamic agent list from llm-server (via ai_list_agents) when
  // the modal opens. The agent registry lives in llm-server, so this avoids
  // hardcoding any agent names on the frontend or in api-server.
  useEffect(() => {
    if (!open || !accountId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setAgentsLoading(true);
        const res = await apiAskNudgebee.listAgents({ accountId });
        // Fail-closed on GraphQL errors so the operator notices a partial
        // failure and doesn't end up with an empty agent-override dropdown.
        const gqlErrors = res?.data?.errors;
        if (Array.isArray(gqlErrors) && gqlErrors.length > 0) {
          if (!cancelled) {
            const msg = gqlErrors[0]?.message || 'Failed to load agent list';
            snackbar.error(msg);
          }
          return;
        }
        const raw = res?.data?.data?.ai_list_agents?.data || [];
        const items = raw
          // Match useAgentConfiguration.ts — only surface agents that are
          // currently enabled. Disabled agents won't be invoked even if
          // configured, so they shouldn't appear in the override dropdown.
          .filter((a) => a?.status === 'enabled')
          .map((a) => {
            const key = a?.aliases?.[0] ?? a?.name;
            if (!key) {
              return null;
            }
            return { key, label: a?.name || key, description: a?.description || '' };
          })
          .filter(Boolean);
        if (!cancelled) {
          setKnownAgents(items);
        }
      } catch (err) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error('AddLLMConfigModal: listAgents failed', err);
          snackbar.error('Failed to load agent list');
        }
      } finally {
        if (!cancelled) {
          setAgentsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, accountId]);

  // Reset / pre-fill the form whenever the modal opens or editData changes.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (isEdit && editData) {
      // Build a name→value lookup from the integration's config rows.
      const cfg = {};
      const values = editData.integration_config_values;
      if (Array.isArray(values)) {
        values.forEach((v) => {
          if (v && v.name) {
            cfg[v.name] = v.value;
          }
        });
      } else if (values && typeof values === 'object') {
        Object.assign(cfg, values);
      }

      setSelectedAccountIds(
        Array.isArray(editData.integrations_cloud_accounts)
          ? editData.integrations_cloud_accounts.map((a) => a?.cloud_account_id).filter(Boolean)
          : []
      );
      setConfigName(editData.name || '');
      setProvider(cfg.llm_provider || '');
      setModel(cfg.llm_model_name || '');
      setFallbacks(cfg.llm_model_fallbacks || '');
      // For encrypted fields, render the mask if a value exists — the backend
      // returns the encrypted ciphertext in editData, but we never show it.
      // The original ciphertext is stashed in `originalSecrets` so we can
      // substitute it back on save/test if the user leaves the mask alone.
      setApiKey(cfg.llm_provider_api_key ? ENCRYPTED_MASK : '');
      setApiEndpoint(cfg.llm_provider_api_endpoint || '');
      setApiVersion(cfg.llm_provider_api_version || '');
      setRegion(cfg.llm_provider_region || '');
      setAccessKey(cfg.llm_provider_access_key ? ENCRYPTED_MASK : '');
      setSecretKey(cfg.llm_provider_secret_key ? ENCRYPTED_MASK : '');
      setApiType(cfg.llm_provider_api_type || '');
      setAdapterId(cfg.llm_provider_adapter_id || '');
      setRequireAdapterId(cfg.llm_provider_require_adapter_id || '');
      setOriginalSecrets({
        llm_provider_api_key: cfg.llm_provider_api_key || '',
        llm_provider_access_key: cfg.llm_provider_access_key || '',
        llm_provider_secret_key: cfg.llm_provider_secret_key || '',
      });

      setTiers({
        reasoning: {
          model: cfg.llm_tier_model_reasoning || '',
          fallbacks: cfg.llm_tier_model_fallbacks_reasoning || '',
        },
        retrieval: {
          model: cfg.llm_tier_model_retrieval || '',
          fallbacks: cfg.llm_tier_model_fallbacks_retrieval || '',
        },
        summary: {
          model: cfg.llm_tier_model_summary || '',
          fallbacks: cfg.llm_tier_model_fallbacks_summary || '',
        },
      });

      // Reconstruct agent rows by scanning for any llm_model_name_<agent> keys.
      const recoveredAgents = [];
      Object.keys(cfg).forEach((key) => {
        if (key.startsWith('llm_model_name_') && key !== 'llm_model_name') {
          const agentKey = key.slice('llm_model_name_'.length);
          // Skip the legacy summary_agent block — that's its own thing.
          if (agentKey === 'summary_agent') {
            return;
          }
          recoveredAgents.push({
            agent: agentKey,
            model: cfg[key] || '',
            fallbacks: cfg[`llm_model_fallbacks_${agentKey}`] || '',
          });
        }
      });
      setAgentRows(recoveredAgents);
    } else {
      setSelectedAccountIds([]);
      setConfigName('');
      setProvider('');
      setModel('');
      setFallbacks('');
      setApiKey('');
      setApiEndpoint('');
      setApiVersion('');
      setRegion('');
      setAccessKey('');
      setSecretKey('');
      setApiType('');
      setAdapterId('');
      setRequireAdapterId('');
      setOriginalSecrets({});
      setTiers({
        reasoning: emptyConfig(),
        retrieval: emptyConfig(),
        summary: emptyConfig(),
      });
      setAgentRows([]);
    }
  }, [open, isEdit, editData]);

  const updateTier = (tier, field, value) => {
    setTiers((prev) => ({ ...prev, [tier]: { ...prev[tier], [field]: value } }));
  };

  const updateAgentRow = (idx, field, value) => {
    setAgentRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const removeAgentRow = (idx) => {
    setAgentRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addAgentRow = () => {
    setAgentRows((prev) => [...prev, { agent: '', model: '', fallbacks: '' }]);
  };

  // Agents already chosen — used to disable them in other rows' agent dropdowns.
  const usedAgents = new Set(agentRows.map((r) => r.agent).filter(Boolean));

  // Conditional credential visibility — mirrors integrations/llm.go ShowWhen rules.
  const showsApiKey = ['anthropic', 'azure', 'googleai', 'huggingface', 'openai', 'vertexai'].includes(provider);
  const showsApiEndpoint = ['azure', 'openai', 'sagemaker', 'anthropic', 'huggingface'].includes(provider);
  const showsApiVersion = provider === 'azure';
  const showsRegion = ['bedrock', 'sagemaker'].includes(provider);
  const showsBedrockKeys = provider === 'bedrock';
  const showsApiType = provider === 'openai';
  const showsAdapter = ['azure', 'huggingface'].includes(provider);

  // A secret field counts as "present" if either the user typed a non-empty
  // value OR the stashed `originalSecrets[name]` is non-empty (Edit flow,
  // user kept the mask). Without this, Edit-without-touching-fields would
  // wrongly disable Save.
  const hasSecret = (current, originalKey) => current.trim() !== '' || !!originalSecrets[originalKey];
  const credsReady =
    (!showsApiKey || hasSecret(apiKey, 'llm_provider_api_key')) &&
    (!showsBedrockKeys || (hasSecret(accessKey, 'llm_provider_access_key') && hasSecret(secretKey, 'llm_provider_secret_key')));

  const canSubmit = configName.trim() !== '' && provider !== '' && model.trim() !== '' && credsReady;

  const buildConfigValues = () => {
    const out = [
      { name: 'llm_provider', value: provider },
      { name: 'llm_model_name', value: model.trim() },
    ];
    if (fallbacks.trim()) {
      out.push({ name: 'llm_model_fallbacks', value: fallbacks.trim() });
    }
    // Provider-specific credential values — only write fields that apply to
    // the chosen provider so we don't pollute the config blob with empty keys
    // from previously-selected providers.
    //
    // Encrypted fields use the same mask convention as IntegrationDynamicFormModal:
    //   - If the user kept the mask (didn't retype the secret), send the mask
    //     with is_encrypted=true so the backend keeps the existing encrypted
    //     value untouched.
    //   - If the user typed a new value, send it with is_encrypted=false so
    //     the backend re-encrypts the new plaintext.
    const pushPlain = (cond, name, value) => {
      if (cond && value && value.trim() !== '') {
        out.push({ name, value: value.trim(), is_encrypted: false });
      }
    };
    // For secret-typed fields the UI shows a mask, never the value.
    //
    // `schemaIsEncrypted` mirrors the backend integration schema's
    // `IsEncrypted` flag for the field:
    //   - true  → backend stores ciphertext at rest. When the user leaves the
    //             mask, we re-send the *ciphertext* originalSecrets[name] with
    //             is_encrypted=true so the backend skips re-encryption.
    //   - false → backend stores plaintext at rest (yes, that's the case for
    //             llm_provider_api_key today). The "original" stashed by the
    //             form is therefore the plaintext, so we re-send it with
    //             is_encrypted=false. Sending is_encrypted=true here would
    //             make the backend's validation path try to hex-decrypt the
    //             plaintext and fail (encoding/hex: invalid byte: …).
    const pushSecret = (cond, name, value, schemaIsEncrypted) => {
      if (!cond || !value || value.trim() === '') {
        return;
      }
      const original = originalSecrets[name] || '';
      // "Unchanged" means EITHER the mask is still in the field, OR the user
      // toggled the eye-icon to reveal the stored value (which substitutes
      // `original` into the field). Both signals must be treated identically;
      // otherwise the revealed-but-unmodified ciphertext falls through to
      // the "new value" branch below and the backend re-encrypts an already-
      // encrypted string → corrupted record at rest.
      if ((value === ENCRYPTED_MASK || value === original) && original) {
        out.push({ name, value: original, is_encrypted: !!schemaIsEncrypted });
      } else {
        // User typed a new plaintext secret — backend will encrypt iff the
        // schema marks the field as encrypted.
        out.push({ name, value: value.trim(), is_encrypted: false });
      }
    };
    // llm_provider_api_key — the backend schema does NOT mark this as
    // encrypted (only access_key / secret_key are). Pass schemaIsEncrypted
    // = false so we never set is_encrypted=true on this field.
    pushSecret(showsApiKey, 'llm_provider_api_key', apiKey, false);
    pushPlain(showsApiEndpoint, 'llm_provider_api_endpoint', apiEndpoint);
    pushPlain(showsApiVersion, 'llm_provider_api_version', apiVersion);
    pushPlain(showsRegion, 'llm_provider_region', region);
    pushSecret(showsBedrockKeys, 'llm_provider_access_key', accessKey, true);
    pushSecret(showsBedrockKeys, 'llm_provider_secret_key', secretKey, true);
    pushPlain(showsApiType, 'llm_provider_api_type', apiType);
    pushPlain(showsAdapter, 'llm_provider_adapter_id', adapterId);
    pushPlain(showsAdapter, 'llm_provider_require_adapter_id', requireAdapterId);
    // Per-tier — write provider + model + fallbacks. Provider mirrors global
    // because the resolver requires both provider and model to fire the tier
    // layer; we don't ask the user for it.
    TIER_KEYS.forEach((tier) => {
      const t = tiers[tier];
      if (t.model.trim() === '') {
        return;
      }
      out.push({ name: `llm_tier_provider_${tier}`, value: provider });
      out.push({ name: `llm_tier_model_${tier}`, value: t.model.trim() });
      if (t.fallbacks.trim()) {
        out.push({ name: `llm_tier_model_fallbacks_${tier}`, value: t.fallbacks.trim() });
      }
    });
    // Per-agent — same reasoning: provider mirrors global so the resolver's
    // env-agent / db-agent layer fires.
    agentRows.forEach((row) => {
      if (!row.agent || row.model.trim() === '') {
        return;
      }
      out.push({ name: `llm_provider_${row.agent}`, value: provider });
      out.push({ name: `llm_model_name_${row.agent}`, value: row.model.trim() });
      if (row.fallbacks.trim()) {
        out.push({ name: `llm_model_fallbacks_${row.agent}`, value: row.fallbacks.trim() });
      }
    });
    return out;
  };

  const handleTest = async () => {
    if (!canSubmit) {
      return;
    }
    setTesting(true);
    try {
      let result;
      if (isEdit && editData?.id) {
        // Existing row — use the by-id Test endpoint so the backend reads
        // creds directly from the stored (server-side encrypted) value.
        // The by-config path requires sending plaintext, which doesn't round
        // -trip cleanly for fields the backend already decrypted in editData.
        // To test *unsaved* changes for an existing row, the user should Save
        // first, then run Test Connection.
        result = await apiIntegrations.testIntegrationConnection(editData.id);
      } else {
        // New row — test with whatever the user typed.
        result = await apiIntegrations.testIntegrationConnectionByConfig('llm', selectedAccountIds, buildConfigValues(), editData?.source || 'user');
      }
      if (result?.success) {
        snackbar.success(result.message || 'Connection successful');
      } else {
        snackbar.error(result?.error || result?.message || 'Connection failed');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('AddLLMConfigModal: testConnection threw', err);
      snackbar.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!canSubmit) {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(isEdit && editData?.id && { integration_id: editData.id }),
        integration_name: 'llm',
        integration_config_name: configName.trim(),
        account_ids: selectedAccountIds,
        source: editData?.source || 'user',
        integration_config_values: buildConfigValues(),
      };
      const response = await apiIntegrations.addIntegrations(payload);
      const configs = response?.data?.data?.integrations_create_config?.configs || [];
      // GraphQL errors land at response.errors; the success path returns
      // configs with the saved fields.
      if (response?.errors?.length || configs.length === 0) {
        // eslint-disable-next-line no-console
        console.error('AddLLMConfigModal: save error', response);
        snackbar.error('Failed to save LLM Provider');
      } else {
        snackbar.success(isEdit ? 'LLM Provider updated' : 'LLM Provider added');
        if (onSaved) {
          onSaved();
        }
        onClose();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('AddLLMConfigModal: save threw', err);
      snackbar.error('Failed to save LLM configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit LLM Provider' : 'Add LLM Provider'} width='md'>
      <Box sx={{ p: 2 }}>
        {/* ---------- Global section ---------- */}
        <Stack spacing={2}>
          <Autocomplete
            multiple
            size='small'
            loading={accountsLoading}
            options={accounts}
            getOptionLabel={(o) => o.name || o.id}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={accounts.filter((a) => selectedAccountIds.includes(a.id))}
            onChange={(_e, newVal) => setSelectedAccountIds(newVal.map((a) => a.id))}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key: _k, ...rest } = getTagProps({ index });
                return <Chip {...rest} key={option.id} label={option.name} size='small' />;
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label='Accounts'
                helperText='List of account identifiers the configuration should apply to. Optional. Auto-populated using listAccounts.'
              />
            )}
          />

          <TextField
            label='Integration Config Name *'
            size='small'
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            helperText='Unique name to identify this integration configuration.'
            required
          />

          <TextField
            select
            label='LLM Provider *'
            size='small'
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            helperText='Name of the LLM provider (openai, bedrock, sagemaker, huggingface, azure, googleai, vertexai, anthropic).'
            required
          >
            {PROVIDERS.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label='LLM Model Name *'
            size='small'
            value={model}
            onChange={(e) => setModel(e.target.value)}
            helperText='Name of the primary model (e.g., gpt-4, claude-opus-4-7, gemini-3.1-pro-preview).'
            required
          />

          <TextField
            label='LLM Model Fallbacks'
            size='small'
            value={fallbacks}
            onChange={(e) => setFallbacks(e.target.value)}
            helperText='Comma-separated list of fallback model names. Optional.'
          />

          {/* Provider-specific credentials — visibility driven by selected provider */}
          {showsApiKey && (
            <MaskedSecretField
              label='API Key *'
              value={apiKey}
              onChange={setApiKey}
              originalValue={originalSecrets.llm_provider_api_key}
              helperText='API key for authenticating with the LLM provider.'
              required
            />
          )}
          {showsApiEndpoint && (
            <TextField
              label={['azure', 'sagemaker', 'huggingface', 'anthropic'].includes(provider) ? 'API Endpoint *' : 'API Endpoint'}
              size='small'
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              helperText='Custom API endpoint for the LLM provider.'
              required={['azure', 'sagemaker', 'huggingface', 'anthropic'].includes(provider)}
            />
          )}
          {showsApiVersion && (
            <TextField
              label='API Version *'
              size='small'
              value={apiVersion}
              onChange={(e) => setApiVersion(e.target.value)}
              helperText='API version of the LLM provider (Azure).'
              required
            />
          )}
          {showsRegion && (
            <TextField
              label='Region *'
              size='small'
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              helperText='Geographic region (e.g., us-east-1).'
              required
            />
          )}
          {showsBedrockKeys && (
            <>
              <MaskedSecretField
                label='AWS Access Key *'
                value={accessKey}
                onChange={setAccessKey}
                originalValue={originalSecrets.llm_provider_access_key}
                helperText='AWS Access Key ID for Bedrock.'
                required
              />
              <MaskedSecretField
                label='AWS Secret Key *'
                value={secretKey}
                onChange={setSecretKey}
                originalValue={originalSecrets.llm_provider_secret_key}
                helperText='AWS Secret Access Key for Bedrock.'
                required
              />
            </>
          )}
          {showsApiType && (
            <TextField
              label='API Type'
              size='small'
              value={apiType}
              onChange={(e) => setApiType(e.target.value)}
              helperText='Type of the API. Optional.'
            />
          )}
          {showsAdapter && (
            <>
              <TextField
                label='Adapter ID'
                size='small'
                value={adapterId}
                onChange={(e) => setAdapterId(e.target.value)}
                helperText='Adapter ID for a fine-tuned model. Optional.'
              />
              <TextField
                label='Require Adapter ID'
                size='small'
                value={requireAdapterId}
                onChange={(e) => setRequireAdapterId(e.target.value)}
                helperText='Whether an adapter ID is required.'
              />
            </>
          )}
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* ---------- Categories ---------- */}
        <Typography variant='subtitle2' sx={{ fontWeight: 600, mb: 1 }}>
          Categories
        </Typography>
        <Typography variant='caption' sx={{ display: 'block', mb: 1.5, color: 'text.secondary' }}>
          Per-category model overrides. Leave a row blank to inherit the global model above.
        </Typography>
        <Table size='small' sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 140, fontWeight: 600 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Model</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Fallbacks</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {TIER_KEYS.map((tierKey) => (
              <TableRow key={tierKey}>
                <TableCell>
                  <Tooltip title={TIER_HINTS[tierKey]} placement='top'>
                    <Box sx={{ fontWeight: 500 }}>{TIER_LABELS[tierKey]}</Box>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    size='small'
                    value={tiers[tierKey].model}
                    placeholder={model || 'e.g. gemini-2.5-flash-lite'}
                    onChange={(e) => updateTier(tierKey, 'model', e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    size='small'
                    value={tiers[tierKey].fallbacks}
                    placeholder='comma-separated'
                    onChange={(e) => updateTier(tierKey, 'fallbacks', e.target.value)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Divider sx={{ my: 3 }} />

        {/* ---------- Agent Overrides ---------- */}
        <Typography variant='subtitle2' sx={{ fontWeight: 600, mb: 1 }}>
          Agent Overrides
        </Typography>
        <Typography variant='caption' sx={{ display: 'block', mb: 1.5, color: 'text.secondary' }}>
          For specific agents that need a different model than their category default. Provider is inherited from the global setting above.
        </Typography>

        {agentRows.length === 0 ? (
          <Box
            sx={{
              p: 2,
              textAlign: 'center',
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              mb: 2,
              color: 'text.secondary',
              fontSize: 13,
            }}
          >
            No agent overrides configured.
          </Box>
        ) : (
          <Table size='small' sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 220, fontWeight: 600 }}>Agent</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Model</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Fallbacks</TableCell>
                <TableCell sx={{ width: 50, fontWeight: 600 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agentRows.map((row, idx) => (
                <TableRow key={`agent-row-${idx}`}>
                  <TableCell>
                    <TextField
                      select
                      fullWidth
                      size='small'
                      value={row.agent}
                      onChange={(e) => updateAgentRow(idx, 'agent', e.target.value)}
                      disabled={agentsLoading}
                    >
                      <MenuItem value=''>{agentsLoading ? '(loading agents…)' : '(select agent)'}</MenuItem>
                      {knownAgents.map((a) => (
                        <MenuItem key={a.key} value={a.key} disabled={a.key !== row.agent && usedAgents.has(a.key)}>
                          {a.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      size='small'
                      value={row.model}
                      placeholder='model name'
                      onChange={(e) => updateAgentRow(idx, 'model', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      size='small'
                      value={row.fallbacks}
                      placeholder='comma-separated'
                      onChange={(e) => updateAgentRow(idx, 'fallbacks', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size='small' onClick={() => removeAgentRow(idx)} data-testid={`remove-agent-row-${idx}`}>
                      <DeleteOutlineIcon fontSize='small' />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <CustomButton id='add-agent-override-row-btn' text='+ Add agent override' variant='secondary' size='Medium' onClick={addAgentRow} />

        {/* ---------- Footer ---------- */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mt: 3 }}>
          <CustomButton
            id='add-llm-config-test-btn'
            text={testing ? 'Testing…' : 'Test Connection'}
            variant='secondary'
            size='Medium'
            onClick={handleTest}
            disabled={!canSubmit || saving || testing}
            loading={testing}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <CustomButton id='add-llm-config-cancel-btn' text='Cancel' variant='secondary' size='Medium' onClick={onClose} disabled={saving} />
            <CustomButton
              id='add-llm-config-save-btn'
              text={saving ? 'Saving…' : isEdit ? 'Save' : 'Add LLM Provider'}
              variant='primary'
              size='Medium'
              onClick={handleSave}
              disabled={!canSubmit || saving || testing}
              loading={saving}
            />
          </Box>
        </Box>
      </Box>
      {accountsLoading && (
        <Box sx={{ position: 'absolute', top: 8, right: 56 }}>
          <CircularProgress size={16} />
        </Box>
      )}
    </Modal>
  );
};

AddLLMConfigModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  editData: PropTypes.object,
  onSaved: PropTypes.func,
  // Used to scope the ai_list_agents fetch for the per-agent override dropdown.
  accountId: PropTypes.string,
};

export default AddLLMConfigModal;
