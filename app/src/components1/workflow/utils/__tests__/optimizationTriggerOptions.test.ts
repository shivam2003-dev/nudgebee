import { getOptimizationCategoryOptions, getOptimizationSourceType } from '@components1/workflow/utils/optimizationTriggerOptions';

describe('optimization trigger category options', () => {
  const sourceOptions = [
    { label: 'AWS production', value: 'aws-account', cloud_provider: 'AWS' },
    { label: 'Kubernetes production', value: 'k8s-account', cloud_provider: 'K8s', account_type: 'kubernetes' },
  ];

  it('shows only cloud-applicable categories for cloud accounts', () => {
    const sourceType = getOptimizationSourceType('aws-account', sourceOptions);
    const values = getOptimizationCategoryOptions(sourceType, []).map((option) => option.value);

    expect(values).toEqual(['RightSizing', 'Configuration', 'Security', 'InfraUpgrade']);
  });

  it('shows Kubernetes categories for K8s accounts', () => {
    const sourceType = getOptimizationSourceType('k8s-account', sourceOptions);
    const values = getOptimizationCategoryOptions(sourceType, []).map((option) => option.value);

    expect(values).toEqual([
      'PodRightSizing',
      'RightSizing',
      'K8sInstanceRecommendation',
      'K8sSpotRecommendation',
      'Configuration',
      'Security',
      'K8sMissingAttribute',
      'InfraUpgrade',
    ]);
  });

  it('detects Kubernetes sources with lowercase provider metadata', () => {
    const sourceType = getOptimizationSourceType('k8s-lowercase', [
      ...sourceOptions,
      { label: 'Kubernetes lowercase', value: 'k8s-lowercase', cloud_provider: 'k8s' },
    ]);

    expect(sourceType).toBe('k8s');
  });

  it('preserves a saved category that is outside the selected source filter', () => {
    const sourceType = getOptimizationSourceType('aws-account', sourceOptions);
    const values = getOptimizationCategoryOptions(sourceType, ['K8sSpotRecommendation']).map((option) => option.value);

    expect(values).toEqual(['RightSizing', 'Configuration', 'Security', 'InfraUpgrade', 'K8sSpotRecommendation']);
  });

  it('keeps all categories visible until a source is selected', () => {
    const sourceType = getOptimizationSourceType('', sourceOptions);
    const values = getOptimizationCategoryOptions(sourceType, []).map((option) => option.value);

    expect(values).toContain('PodRightSizing');
    expect(values).toContain('InfraUpgrade');
  });
});
