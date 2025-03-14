export default function Accordion({
  question = "Q",
  answer = "A",
}: {
  question: string;
  answer: string;
}) {
  return (
    <div className="collapse collapse-arrow bg-green">
      <input type="checkbox" />
      <div className="collapse-title text-xl font-medium text-blue sm:text-2xl">
        <h1>{question}</h1>
      </div>
      <div className="collapse-content text-justify text-xl">
        <p dangerouslySetInnerHTML={{ __html: answer }}></p>
      </div>
    </div>
  );
}
