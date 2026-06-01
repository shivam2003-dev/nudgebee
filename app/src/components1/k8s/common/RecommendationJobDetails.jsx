import Datetime from '@common-new/format/Datetime';
import { useData } from '@context/DataContext';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';

export default function RecommendationJobDetails({ jobName }) {
  const { selectedCluster } = useData();
  const [recommendationJob, setRecommendationJob] = useState({});

  useEffect(() => {
    if (!jobName) {
      setRecommendationJob({});
      return;
    }
    let job = {};
    for (let j of selectedCluster?.agent?.connection_status?.schedule_jobs ?? []) {
      if (j?.runnable_params?.action_func_name == jobName) {
        job = j;
        break;
      }
    }
    setRecommendationJob(job);
  }, [jobName, selectedCluster]);

  const lastExecTime = recommendationJob?.state?.last_exec_time_sec;
  if (Object.keys(recommendationJob).length === 0 || !lastExecTime) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', pt: 2, mb: 2 }}>
      <AutorenewIcon sx={{ fontSize: '16px', color: 'var(--ds-gray-400)' }} />
      <Datetime
        value={new Date(lastExecTime * 1000)}
        prefix='Refreshed '
        sxPrefix={{ fontSize: 'var(--ds-text-body)', color: 'var(--ds-gray-400)' }}
        sxPrefixSecondary={false}
        sx={{ fontSize: 'var(--ds-text-body)', fontWeight: 600, color: 'var(--ds-gray-500)' }}
        sxSuffix={{ fontSize: 'var(--ds-text-body)', color: 'var(--ds-gray-400)' }}
        sxSuffixSecondary={false}
        sxSecondary={false}
      />
    </Box>
  );
}

RecommendationJobDetails.propTypes = {
  jobName: PropTypes.string.isRequired,
};
