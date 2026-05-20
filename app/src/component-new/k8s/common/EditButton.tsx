/**
 * @deprecated Use <Button tone="ghost" composition="icon-only" icon={<Edit/>} aria-label="Edit" /> from '@components1/ds/Button' instead.
 * Tracked for removal 2026-06-06 (30-day deprecation clock from V2 ship 2026-05-07).
 */
import { IconButton } from '@mui/material';
import { EditOutlined } from '@mui/icons-material';
import { colors } from 'src/utils/colors';

interface EditButtonProps {
  onClick: () => void;
}

const EditButton: React.FC<EditButtonProps> = ({ onClick }) => {
  return (
    <IconButton
      style={{
        border: `0.5px solid ${colors.button.secondaryBorder}`,
        width: '32px',
        height: '32px',
        borderRadius: '4px',
        color: '#FCA5A5',
      }}
      onClick={onClick}
    >
      <EditOutlined />
    </IconButton>
  );
};

export default EditButton;
