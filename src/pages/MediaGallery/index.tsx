import { useState } from "react";
import { getGalleryPhotos, getVideos } from "@/api/media";
import { PageHeader, Tabs } from "@/components/ui/primitives";
import { useList } from "@/hooks/useList";
import { PhotosTab } from "./PhotosTab";
import { VideosTab } from "./VideosTab";

/** Media & Gallery: two tabs, the videos and the photos of the website's Media & Gallery page. */
export default function MediaGallery() {
  const [tab, setTab] = useState("videos");
  const videos = useList("gallery_videos", getVideos);
  const photos = useList("gallery_photos", getGalleryPhotos);
  return (
    <div>
      <PageHeader title="Media & Gallery">The videos and photos shown on the website Media & Gallery page.</PageHeader>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "videos", label: "Videos", count: videos.loading ? undefined : videos.rows.length },
          { key: "photos", label: "Photos", count: photos.loading ? undefined : photos.rows.length }
        ]}
      />
      {tab === "videos" ? <VideosTab /> : <PhotosTab />}
    </div>
  );
}
