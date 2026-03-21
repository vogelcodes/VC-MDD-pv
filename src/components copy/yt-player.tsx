import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";

export default function YoutubePlayer() {
  return (
    <div
            className="mx-auto mb-4 aspect-video w-full lg:max-w-[53.25rem]"
    >
      <LiteYouTubeEmbed
        id="ND5HhW72fWM"
        title="Método LactoFlow®"
        poster="maxresdefault"
        webp
      />
    </div>
  );
}
