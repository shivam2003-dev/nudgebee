import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Card, Chip, Divider, Stack, Paper, Alert, CircularProgress } from '@mui/material';
import { Checkbox } from '@components1/ds/Checkbox';
import { Input } from '@components1/ds/Input';
import FilterDropdownButton from './FilterDropdownButton';
import CustomIconButton from '@components1/CustomIconButton';
import { action } from 'src/utils/actionStyles';
import { PlusIcon } from '@assets';
import TextWithBorder from '@components1/common/TextWithBorder';
import { colors } from 'src/utils/colors';
import DeleteButton from '@components1/k8s/common/DeleteButton';
import { Textarea } from '@components1/k8s/common/TextArea';
import { snakeToTitleCase } from 'src/utils/common';
import SigNozQueryAutocomplete from '@components1/events/SigNozQueryAutocomplete';
import SafeIcon from './SafeIcon';

const errorBorderStyle = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'var(--ds-red-500) !important',
      borderWidth: '1px',
    },
  },
};

const DynamicForm = ({ actionKey, onChange, errors = {}, initialValues = {}, actionDetails = {}, accountId, onClearError }) => {
  // Helper function to get nested value from object using dot notation
  const getNestedValue = (obj, path) => {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current && typeof current === 'object') {
        current = current[key];
      } else {
        return undefined;
      }
    }
    return current;
  };

  // Helper function to set nested value in object using dot notation
  const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  };

  // Helper function to get default value based on field type
  const getDefaultValue = (field) => {
    if (field.default !== undefined) {
      return field.default;
    }

    switch (field.type) {
      case 'string[]':
      case 'list':
      case 'object[]':
        return [];
      case 'map':
        return {};
      case 'object':
        return field.extra_params && Object.keys(field.extra_params).length > 0 ? {} : '';
      case 'bool':
        return false;
      case 'int':
        return 0;
      default:
        return '';
    }
  };

  // Initialize form values including nested objects
  const initializeFormValues = (params, initialVals = {}) => {
    const values = { ...initialVals };

    const processParams = (paramObj, parentPath = '') => {
      Object.keys(paramObj).forEach((key) => {
        const field = paramObj[key];
        const currentPath = parentPath ? `${parentPath}.${key}` : key;

        if (getNestedValue(values, currentPath) === undefined) {
          setNestedValue(values, currentPath, getDefaultValue(field));
        }

        // Process nested parameters
        if (field.type === 'object' && field.extra_params) {
          processParams(field.extra_params, currentPath);
        }
      });
    };

    processParams(params);
    return values;
  };

  const [formValues, setFormValues] = useState(() => initializeFormValues(actionDetails?.params || {}, initialValues));
  const [mapInputs, setMapInputs] = useState({});
  const [stringArrayInputs, setStringArrayInputs] = useState({});
  const [enrichedParams, setEnrichedParams] = useState(actionDetails?.params || {});

  // API call function for auto_generate_func.
  // No funcName implementations remain; add a new branch (with the
  // loading-state toggle) here when adding an `auto_generate_func`
  // value to a param in event_actions_template.json.
  const callAutoGenerateAPI = async (_funcName, _paramKey, _accountId) => {
    return [];
  };

  // Effect to handle auto_generate_func for parameters
  useEffect(() => {
    const processAutoGenerateFields = async () => {
      const params = actionDetails?.params || {};
      const updatedParams = { ...params };

      for (const [key, field] of Object.entries(params)) {
        if (field.auto_generate_func && !field.possible_values) {
          try {
            const generatedValues = await callAutoGenerateAPI(field.auto_generate_func, key, accountId);
            updatedParams[key] = {
              ...field,
              possible_values: generatedValues,
            };
          } catch (error) {
            console.error(`Failed to generate values for ${key}:`, error);
          }
        }
      }

      setEnrichedParams(updatedParams);
    };

    if (actionDetails?.params) {
      processAutoGenerateFields();
    }
  }, [actionDetails]);

  // Enhanced change handler for nested objects
  const handleChange = (path, value) => {
    setFormValues((prevValues) => {
      const updatedValues = { ...prevValues };
      setNestedValue(updatedValues, path, value);

      if (onChange) {
        if (getNestedValue(errors, path) && typeof onClearError === 'function') {
          onClearError(path);
        }
        onChange({ [actionKey]: updatedValues });
      }
      return updatedValues;
    });
  };

  const handleMapInputChange = (paramKey, field, value) => {
    setMapInputs((prev) => ({
      ...prev,
      [paramKey]: {
        ...prev[paramKey],
        [field]: value,
      },
    }));
  };

  const handleStringArrayInputChange = (paramKey, value) => {
    setStringArrayInputs((prev) => ({
      ...prev,
      [paramKey]: value,
    }));
  };

  const handleAddStringToArray = (paramKey) => {
    const value = stringArrayInputs[paramKey];
    if (value?.trim()) {
      const currentArray = getNestedValue(formValues, paramKey) || [];
      handleChange(paramKey, [...currentArray, value.trim()]);
      setStringArrayInputs((prev) => ({
        ...prev,
        [paramKey]: '',
      }));
    }
  };

  const handleAddObjectToArray = (paramKey, fields) => {
    const newInputs = getNestedValue(formValues, `${paramKey}.new`) || {};

    const allFieldsFilled = fields.every((field) => newInputs[field] !== undefined && newInputs[field] !== '');

    if (allFieldsFilled) {
      const currentArray = getNestedValue(formValues, paramKey);

      // Ensure it's an array
      const safeArray = Array.isArray(currentArray) ? currentArray : [];

      handleChange(paramKey, [...safeArray, newInputs]);

      // Reset new object inputs
      handleChange(`${paramKey}.new`, {});
    }
  };

  const handleDeleteStringFromArray = (paramKey, index) => {
    const currentArray = getNestedValue(formValues, paramKey) || [];
    handleChange(
      paramKey,
      currentArray.filter((_, i) => i !== index)
    );
  };

  const handleDeleteObjectFromArray = (paramKey, index) => {
    const currentArray = getNestedValue(formValues, paramKey) || [];
    handleChange(
      paramKey,
      currentArray.filter((_, i) => i !== index)
    );
  };

  const handleAddMapEntry = (paramKey) => {
    const { key, value } = mapInputs[paramKey] || {};
    if (key && value) {
      const currentMap = getNestedValue(formValues, paramKey) || {};
      handleChange(paramKey, { ...currentMap, [key]: value });
      setMapInputs((prev) => ({
        ...prev,
        [paramKey]: { key: '', value: '' },
      }));
    }
  };

  const handleDeleteMapEntry = (paramKey, keyToDelete) => {
    const currentMap = getNestedValue(formValues, paramKey) || {};
    const updatedMap = { ...currentMap };
    delete updatedMap[keyToDelete];
    handleChange(paramKey, updatedMap);
  };

  const transformInputToChipArray = (inputArray) => {
    if (!inputArray) {
      return [];
    }
    return inputArray.map((item, index) => ({
      label: item.key.key,
      operator: item.op,
      value: item.value,
      id: index,
    }));
  };

  const shouldShowField = (field, formValues) => {
    if (!field.show_when) {
      return true;
    }

    return Object.entries(field.show_when).every(([depKey, expectedValue]) => {
      const actualValue = getNestedValue(formValues, depKey);
      return actualValue === expectedValue;
    });
  };

  const renderFieldGroup = (key, field, parentPath = '', depth = 0) => {
    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    const currentValue = getNestedValue(formValues, currentPath);
    const errorText = getNestedValue(errors, currentPath) || '';
    // Loading state was previously driven by callAutoGenerateAPI for async
    // value generation; no async funcName branches remain. Re-add a
    // loadingFields state hook here if you add one.
    const isLoading = false;

    const isVisible = shouldShowField(field, formValues);

    const getErrorStyles = (error) => (error ? errorBorderStyle : {});

    // showErrorAlert: when the wrapped child renders its own error message (DS Input does), the
    // outer Alert would duplicate it. Pass `false` for those fields.
    const fieldWrapper = (children, showDescription = true, showErrorAlert = true) => (
      <Box sx={{ mb: 3 }}>
        <Typography
          sx={{
            fontSize: 'var(--ds-text-body-lg)',
            fontWeight: 'var(--ds-font-weight-semibold)',
            color: 'var(--ds-brand-500)',
            mb: 'var(--ds-space-1)',
          }}
        >
          {field.display_name || key}
          {field.required && (
            <Typography component='span' sx={{ color: 'error.main', ml: 0.5 }}>
              *
            </Typography>
          )}
          {isLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
        </Typography>
        {children}
        {showDescription && field.description && (
          <Typography variant='caption' color='text.secondary' sx={{ mt: 'var(--ds-space-1)', display: 'block' }}>
            {field.description}
          </Typography>
        )}
        {showErrorAlert && errorText && typeof errorText === 'string' && (
          <Alert severity='error' sx={{ mt: 1 }}>
            {errorText}
          </Alert>
        )}
      </Box>
    );

    if (!isVisible) {
      return fieldWrapper(
        <Input
          key={currentPath}
          value={typeof currentValue === 'object' ? '' : currentValue || ''}
          size='sm'
          disabled
          onChange={() => {}}
          placeholder={`${(field.display_name || key).toLowerCase()}`}
        />,
        true
      );
    }

    switch (field.type) {
      case 'object[]':
        return fieldWrapper(
          <Box>
            {/* Render existing objects */}
            {(currentValue || []).length > 0 && (
              <Stack spacing={2} sx={{ mb: 2 }}>
                {(currentValue || []).map((_obj, index) => (
                  <Card key={index} variant='outlined' sx={{ p: 2, position: 'relative' }}>
                    <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                      <DeleteButton onClick={() => handleDeleteObjectFromArray(currentPath, index)} disabled={isLoading} />
                    </Box>

                    <Stack spacing={2}>
                      {Object.keys(field.extra_params || {}).map((subKey) =>
                        renderFieldGroup(
                          subKey,
                          field.extra_params[subKey],
                          `${currentPath}.${index}`, // ✅ include index in path
                          depth + 1
                        )
                      )}
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}

            {/* Inputs for a NEW object */}
            {field.extra_params && (
              <Card variant='outlined' sx={{ p: 2, borderStyle: 'dashed' }}>
                <Typography variant='body2' sx={{ mb: 1, fontWeight: 'var(--ds-font-weight-medium)' }}>
                  Add New {(field.display_name || key).toLowerCase()}
                </Typography>

                <Stack spacing={2}>
                  {Object.keys(field.extra_params).map((subKey) =>
                    renderFieldGroup(subKey, field.extra_params[subKey], `${currentPath}.new`, depth + 1)
                  )}
                </Stack>

                <Box mt={2}>
                  <CustomIconButton
                    sx={{ ...action.blueOutline, width: '32px', height: '32px' }}
                    onClick={() => handleAddObjectToArray(currentPath, Object.keys(field.extra_params))}
                    isDisabled={isLoading}
                    size='small'
                  >
                    <SafeIcon src={PlusIcon} alt='add field' />
                  </CustomIconButton>
                </Box>
              </Card>
            )}
          </Box>
        );

      case 'object':
        if (field.extra_params) {
          return (
            <Box key={key} sx={{ mb: 3 }}>
              <Card variant='outlined' sx={{ backgroundColor: depth === 0 ? '#f9fafb' : '#ffffff' }}>
                <Box sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography
                      sx={{ fontSize: 'var(--ds-text-body-lg)', fontWeight: 'var(--ds-font-weight-semibold)', color: 'var(--ds-brand-500)' }}
                    >
                      {field.display_name || key}
                      {field.required && (
                        <Typography component='span' sx={{ color: 'error.main', ml: 0.5 }}>
                          *
                        </Typography>
                      )}
                    </Typography>
                  </Box>

                  {field.description && (
                    <Typography variant='caption' color='text.secondary' sx={{ mb: 2, display: 'block' }}>
                      {field.description}
                    </Typography>
                  )}
                  <Box sx={{ pl: 2, borderLeft: '2px solid var(--ds-brand-150)', mt: 2 }}>
                    <Stack spacing={2}>
                      {Object.keys(field.extra_params).map((subKey) => renderFieldGroup(subKey, field.extra_params[subKey], currentPath, depth + 1))}
                    </Stack>
                  </Box>
                </Box>
              </Card>
            </Box>
          );
        }
        return null;

      case 'list':
        if (field.possible_values) {
          return fieldWrapper(
            <FilterDropdownButton
              key={`auto-complete-${currentPath}`}
              multiple={Array.isArray(field.default)}
              label=''
              value={currentValue || (Array.isArray(field.default) ? [] : '')}
              options={field.possible_values ?? []}
              disabled={field.possible_values?.length === 0 || isLoading}
              onSelect={(_, val) => handleChange(currentPath, Array.isArray(val) ? val.map((v) => v?.value ?? v) : val?.value ?? val)}
            />
          );
        }
        break;

      case 'int':
      case 'number':
        return fieldWrapper(
          <Box sx={{ width: '400px' }}>
            <Input
              key={currentPath}
              type='number'
              value={currentValue !== null && currentValue !== undefined ? String(currentValue) : ''}
              onChange={(value) => handleChange(currentPath, parseInt(value, 10) || 0)}
              size='sm'
              error={errorText && typeof errorText === 'string' ? errorText : undefined}
              disabled={isLoading}
              placeholder={`${(field.display_name || key).toLowerCase()}`}
            />
          </Box>,
          true,
          false
        );

      case 'bool':
        return fieldWrapper(
          <Checkbox
            checked={!!currentValue}
            onChange={(next) => handleChange(currentPath, next)}
            disabled={isLoading}
            label={`Enable ${field.display_name || key}`}
          />,
          true
        );

      case 'string':
        if (field.possible_values?.length > 0) {
          return fieldWrapper(
            <FilterDropdownButton
              key={currentPath}
              options={field.possible_values}
              value={currentValue || ''}
              onSelect={(_, val) => handleChange(currentPath, val?.value ?? val)}
              disabled={isLoading}
              label={snakeToTitleCase(key)}
            />
          );
        }
        return fieldWrapper(
          <Box sx={{ width: '400px' }}>
            <Input
              key={currentPath}
              value={currentValue || ''}
              onChange={(value) => handleChange(currentPath, value)}
              size='sm'
              error={errorText && typeof errorText === 'string' ? errorText : undefined}
              disabled={field.is_editable === false || isLoading}
              placeholder={`${(field.display_name || key).toLowerCase()}`}
            />
          </Box>,
          true,
          false
        );

      case 'textarea':
        return fieldWrapper(
          <Textarea
            value={currentValue || ''}
            placeholder={`${(field.display_name || key).toLowerCase()}`}
            onChange={(e) => handleChange(currentPath, e.target.value)}
            disabled={isLoading}
            minRows={10}
            maxRows={200}
            sx={{
              ...getErrorStyles(errorText),
            }}
          />
        );

      case 'map':
        return fieldWrapper(
          <Box>
            {Object.keys(currentValue || {}).length > 0 && (
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Typography variant='body2' sx={{ mb: 1, fontWeight: 'var(--ds-font-weight-medium)' }} />
                <Stack spacing={1}>
                  {Object.entries(currentValue || {}).map(([mapKey, mapValue]) => (
                    <Box key={mapKey} display='flex' alignItems='center' justifyContent='space-between'>
                      <Chip label={`${mapKey}: ${mapValue}`} variant='outlined' size='small' />
                      <DeleteButton onClick={() => handleDeleteMapEntry(currentPath, mapKey)} disabled={isLoading} />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}
            <Box display='flex' gap={1} alignItems='center'>
              <Box sx={{ flex: 1 }}>
                <Input
                  label='Key'
                  value={mapInputs[currentPath]?.key || ''}
                  size='sm'
                  disabled={isLoading}
                  onChange={(value) => handleMapInputChange(currentPath, 'key', value)}
                  error={errorText?.key || undefined}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Input
                  label='Value'
                  value={mapInputs[currentPath]?.value || ''}
                  size='sm'
                  disabled={isLoading}
                  onChange={(value) => handleMapInputChange(currentPath, 'value', value)}
                  error={errorText?.key || undefined}
                />
              </Box>
              <CustomIconButton
                sx={{ ...action.blueOutline, ml: 2, width: '32px', height: '32px' }}
                onClick={() => handleAddMapEntry(currentPath)}
                isDisabled={isLoading}
              >
                <SafeIcon src={PlusIcon} alt='add field' />
              </CustomIconButton>
            </Box>
          </Box>
        );

      case 'string[]':
        return fieldWrapper(
          <Box>
            {(currentValue || []).length > 0 && (
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Typography variant='body2' sx={{ mb: 1, fontWeight: 'var(--ds-font-weight-medium)' }} />
                <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                  {(currentValue || []).map((value, index) => (
                    <Chip
                      key={index}
                      label={value}
                      onDelete={isLoading ? undefined : () => handleDeleteStringFromArray(currentPath, index)}
                      variant='outlined'
                      size='small'
                    />
                  ))}
                </Stack>
              </Paper>
            )}
            <Box display='flex' gap={1} alignItems='center'>
              <Box sx={{ flex: 1, maxWidth: '400px' }}>
                <Input
                  value={stringArrayInputs[currentPath] || ''}
                  size='sm'
                  disabled={isLoading}
                  onChange={(value) => handleStringArrayInputChange(currentPath, value)}
                  placeholder={`Add ${(field.display_name || key).toLowerCase()}`}
                  // onKeyPress is deprecated in React; DS Input exposes onKeyDown which fires for Enter.
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoading) {
                      handleAddStringToArray(currentPath);
                    }
                  }}
                  error={errorText && typeof errorText === 'string' ? errorText : undefined}
                />
              </Box>
              <CustomIconButton
                sx={{ ...action.blueOutline, ml: 2, width: '32px', height: '32px' }}
                onClick={() => handleAddStringToArray(currentPath)}
                isDisabled={isLoading}
                size='small'
              >
                <SafeIcon src={PlusIcon} alt='add field' />
              </CustomIconButton>
            </Box>
          </Box>,
          true,
          false
        );

      case 'signoz_log_autocomplete':
        return fieldWrapper(
          <Box sx={{ width: '100%', maxWidth: '800px' }}>
            <SigNozQueryAutocomplete
              accountId={accountId}
              onQueryChange={(newQuery) => {
                handleChange(currentPath, newQuery);
              }}
              queryItems={transformInputToChipArray(currentValue) || []}
            />
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ maxWidth: 600, width: '100%' }}>
      <Box sx={{ padding: '0px 0px var(--ds-space-3) var(--ds-space-4)', width: '100%', borderBottom: '1px solid var(--ds-brand-150)' }}>
        <Typography
          sx={{
            fontSize: 'var(--ds-text-body-lg)',
            fontWeight: 'var(--ds-font-weight-semibold)',
            color: 'var(--ds-brand-500)',
            mb: 'var(--ds-space-1)',
          }}
        >
          Trigger Conditions (Optional)
        </Typography>
        <Textarea
          value={formValues.if || ''}
          placeholder='Define conditions as Python Template'
          onChange={(e) => handleChange('if', e.target.value)}
          minRows={2}
          maxRows={8}
        />
      </Box>

      {/* Parameters Section */}
      {Object.keys(enrichedParams).length > 0 && (
        <Box>
          <TextWithBorder
            value='Action Parameters'
            borderColor={colors.primary}
            borderWidth='3px'
            sx={{
              '& p': {
                fontSize: 'var(--ds-text-title)',
                fontWeight: 'var(--ds-font-weight-semibold)',
                color: colors.text.secondary,
                margin: 'var(--ds-space-5) 0px var(--ds-space-4) 0px',
              },
            }}
          />
          <Box sx={{ padding: '0px 0px var(--ds-space-3) var(--ds-space-4)', width: '100%' }}>
            <Stack spacing={0}>
              {Object.keys(enrichedParams).map((key, index) => (
                <Box key={key}>
                  {renderFieldGroup(key, enrichedParams[key])}
                  {index < Object.keys(enrichedParams).length - 1 && <Divider sx={{ my: 'var(--ds-space-4)' }} />}
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      )}
    </Box>
  );
};

DynamicForm.propTypes = {
  onChange: PropTypes.func,
  actionKey: PropTypes.string,
  errors: PropTypes.object,
  initialValues: PropTypes.object,
  actionDetails: PropTypes.object,
  accountId: PropTypes.string,
  onClearError: PropTypes.func,
};

export default DynamicForm;
