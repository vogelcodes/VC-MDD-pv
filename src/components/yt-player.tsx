import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";

export default function YoutubePlayer() {
  return (
    <div
      data-umami-event="Watch Video"
      className="mx-auto mb-4 aspect-video w-full lg:max-w-[53.25rem]"
    >
      <LiteYouTubeEmbed
        data-umami-event="Watch Video"
        id="eXp3-bclWPs"
        title="Método LactoFlow®️"
        poster="maxresdefault"
      />
    </div>
  );
}
