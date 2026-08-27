import { redirect } from 'next/navigation';

export default function HomePage() {
  // Automatically send users to the new secure lobby
  redirect('/lobby');
}