export interface WorkflowAccountOption {
  label: string;
  value: string;
  cloud_provider?: string;
  account_type?: string;
}

export interface OptimizationCategoryOption {
  label: string;
  value: string;
}

export type OptimizationSourceType = 'all' | 'cloud' | 'k8s';

export const OPTIMIZATION_CATEGORY_OPTIONS: OptimizationCategoryOption[] = [
  { label: 'Pod Right Sizing', value: 'PodRightSizing' },
  { label: 'Right Sizing', value: 'RightSizing' },
  { label: 'K8s Instance Recommendation', value: 'K8sInstanceRecommendation' },
  { label: 'K8s Spot Recommendation', value: 'K8sSpotRecommendation' },
  { label: 'Configuration', value: 'Configuration' },
  { label: 'Security', value: 'Security' },
  { label: 'K8s Missing Attribute', value: 'K8sMissingAttribute' },
  { label: 'Infra Upgrade', value: 'InfraUpgrade' },
];

const CLOUD_OPTIMIZATION_CATEGORY_VALUES = new Set(['RightSizing', 'Configuration', 'Security', 'InfraUpgrade']);

const K8S_OPTIMIZATION_CATEGORY_VALUES = new Set([
  'PodRightSizing',
  'RightSizing',
  'K8sInstanceRecommendation',
  'K8sSpotRecommendation',
  'Configuration',
  'Security',
  'K8sMissingAttribute',
  'InfraUpgrade',
]);

export const getOptimizationSourceType = (sourceId: string, sourceOptions: WorkflowAccountOption[]): OptimizationSourceType => {
  if (!sourceId) {
    return 'all';
  }

  const selectedSource = sourceOptions.find((option) => option.value === sourceId);
  if (!selectedSource) {
    return 'all';
  }

  if (selectedSource.cloud_provider === 'K8s' || selectedSource.account_type?.toLowerCase() === 'kubernetes') {
    return 'k8s';
  }

  return 'cloud';
};

const categoryLabelByValue = OPTIMIZATION_CATEGORY_OPTIONS.reduce<Record<string, string>>((labels, option) => {
  labels[option.value] = option.label;
  return labels;
}, {});

export const getOptimizationCategoryOptions = (sourceType: OptimizationSourceType, selectedCategories: string[]): OptimizationCategoryOption[] => {
  const allowedValues = sourceType === 'cloud' ? CLOUD_OPTIMIZATION_CATEGORY_VALUES : sourceType === 'k8s' ? K8S_OPTIMIZATION_CATEGORY_VALUES : null;
  const options = allowedValues
    ? OPTIMIZATION_CATEGORY_OPTIONS.filter((option) => allowedValues.has(option.value))
    : [...OPTIMIZATION_CATEGORY_OPTIONS];
  const seen = new Set(options.map((option) => option.value));

  for (const category of selectedCategories) {
    if (!category || seen.has(category)) {
      continue;
    }
    options.push({ label: categoryLabelByValue[category] || category, value: category });
    seen.add(category);
  }

  return options;
};
