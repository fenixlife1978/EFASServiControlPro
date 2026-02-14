import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to login page as the root is not public
  redirect('/login');
}
