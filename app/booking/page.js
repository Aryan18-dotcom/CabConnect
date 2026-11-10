import BookingWizard from '../../components/booking-wizard';

export const metadata = {
  title: 'Plan Your Journey',
  description: 'Enter trip details, compare vehicle estimates and send a travel inquiry to Chirag Travels.'
};

export default function BookingPage() {
  return <BookingWizard />;
}
