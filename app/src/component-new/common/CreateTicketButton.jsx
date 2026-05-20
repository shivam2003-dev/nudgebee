/**
 * @deprecated Use <Button tone="secondary" icon={<Add/>}>Create ticket</Button> from '@components1/ds/Button' instead.
 * Tracked for removal 2026-06-06 (30-day deprecation clock from V2 ship 2026-05-07).
 */
import TicketsIcon from '@assets/sidebar-icon/tickets-icon.svg';
import { IconButton } from '@mui/material';
import SafeIcon from './SafeIcon';
import CustomTooltip from './CustomTooltip';

const CreateTicketButton = ({ onClick, sx }) => {
  return (
    <CustomTooltip title='Create Ticket' aria-label='Create Ticket'>
      <IconButton
        sx={{
          ...sx,
        }}
        onClick={onClick}
        aria-label='Create Ticket'
        id='create-ticket'
      >
        <SafeIcon priority={true} src={TicketsIcon} alt='Create Ticket' />
      </IconButton>
    </CustomTooltip>
  );
};

export default CreateTicketButton;
