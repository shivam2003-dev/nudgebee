/**
 * @deprecated Use <Button tone="danger" composition="icon-only" icon={<Block/>} aria-label="Disable" /> from '@components1/ds/Button' instead.
 * Tracked for removal 2026-06-06 (30-day deprecation clock from V2 ship 2026-05-07).
 */
import { IconButton } from '@mui/material';
import { DisabledByDefaultOutlined } from '@mui/icons-material';
import { colors } from 'src/utils/colors';

interface DisableButtonProps {
  onClick: () => void;
}

const DisableButton: React.FC<DisableButtonProps> = ({ onClick }) => {
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
      <DisabledByDefaultOutlined />
    </IconButton>
  );
};

export default DisableButton;
