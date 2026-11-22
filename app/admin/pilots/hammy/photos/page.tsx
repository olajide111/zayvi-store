import Link from 'next/link';
import AdminPageHeading from '@/components/admin/AdminPageHeading';
import HammyPhotoWorkspace from '@/components/pilots/HammyPhotoWorkspace';
export default function HammyPhotos(){return <main className="min-h-screen bg-[#f7f8fb]"><AdminPageHeading section="Hammy Store" title="Product photos" description="Arrange and upload product photography for your customised store."><Link href="/admin/pilots/hammy" className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm">Back to Hammy</Link></AdminPageHeading><div className="mx-auto max-w-6xl p-4 sm:p-6"><HammyPhotoWorkspace/></div></main>;}
