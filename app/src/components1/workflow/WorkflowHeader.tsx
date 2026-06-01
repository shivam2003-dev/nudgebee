import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Input } from '@components1/ds/Input';
import { Button } from '@components1/ds/Button';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import NewToggleButtons from './NewToggleButtons';
import { colors } from 'src/utils/colors';
import CustomBackButton from '@common-new/CustomBackButton';
import { useRouter } from 'next/router';
interface WorkflowHeaderProps {
  workflowTitle?: string;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
  onTitleChange?: (title: string) => void;
  allowTitleEdit?: boolean;
  accountId?: string;
  onOpenAiChat?: () => void;
  showAiChatButton?: boolean;
  canEdit?: boolean;
}

const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
  workflowTitle = 'Automation Title',
  onTabChange,
  activeTab = 'editor',
  onTitleChange,
  allowTitleEdit = false,
  accountId,
  onOpenAiChat,
  showAiChatButton = false,
  canEdit = true,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(workflowTitle);

  const handleTitleEdit = () => {
    setEditedTitle(workflowTitle);
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    if (onTitleChange && editedTitle.trim()) {
      onTitleChange(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setEditedTitle(workflowTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const tabOptions = canEdit
    ? [
        { value: 'editor', label: 'Editor' },
        { value: 'executions', label: 'Executions' },
      ]
    : [{ value: 'executions', label: 'Executions' }];

  const effectiveAllowTitleEdit = allowTitleEdit && canEdit;

  const router = useRouter();

  const handleBack = () => {
    // Check for returnUrl query param first (for navigation from investigate pages)
    const { returnUrl } = router.query;
    if (returnUrl) {
      router.push(decodeURIComponent(returnUrl as string));
    } else {
      const backButtonPath = `/auto-pilot?accountId=${accountId}#workflow`;
      router.push(backButtonPath);
    }
  };

  return (
    <Box
      sx={{
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: 'var(--ds-background-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--ds-space-4)',
        zIndex: 10,
        borderBottom: '1px solid rgb(229, 229, 229)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CustomBackButton id='workflow-back-btn' onClick={handleBack} />

        {isEditingTitle ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Input value={editedTitle} onChange={setEditedTitle} onKeyDown={handleTitleKeyPress} size='sm' />

            <Button
              id='workflow-title-save-btn'
              composition='icon-only'
              tone='ghost'
              size='sm'
              aria-label='Save title'
              icon={<CheckIcon fontSize='small' sx={{ color: 'var(--ds-green-400)' }} />}
              onClick={handleTitleSave}
            />
            <Button
              id='workflow-title-cancel-btn'
              composition='icon-only'
              tone='ghost'
              size='sm'
              aria-label='Cancel edit'
              icon={<CloseIcon fontSize='small' sx={{ color: 'var(--ds-red-500)' }} />}
              onClick={handleTitleCancel}
            />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant='h6'
              sx={{
                color: colors.text.secondary,
                fontSize: 'var(--ds-text-title)',
                fontWeight: 'var(--ds-font-weight-medium)',
                margin: 0,
              }}
            >
              {workflowTitle}
            </Typography>

            {effectiveAllowTitleEdit && onTitleChange && (
              <Button
                id='workflow-title-edit-btn'
                composition='icon-only'
                tone='ghost'
                size='sm'
                aria-label='Edit title'
                icon={<EditIcon fontSize='small' sx={{ color: 'var(--ds-gray-600)' }} />}
                onClick={handleTitleEdit}
              />
            )}
          </Box>
        )}
      </Box>

      {/* Tab Toggle - Centered on bottom border - Only show if onTabChange is provided */}
      {onTabChange && (
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '24px',
            transform: 'translateX(-50%)',
            zIndex: 11,
          }}
        >
          <NewToggleButtons options={tabOptions} noShadow={true} activeValue={activeTab} onChange={(value) => onTabChange?.(value)} width='260px' />
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* AI Chat Button - Only show if conversation exists */}
        {showAiChatButton && onOpenAiChat && (
          <Button id='workflow-continue-ai-btn' tone='secondary' size='md' onClick={onOpenAiChat}>
            Continue with AI
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default WorkflowHeader;
