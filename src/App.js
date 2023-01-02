import "./App.css";
import { useState, useEffect } from "react";
import ScaleLoader from "react-spinners/ScaleLoader";

const PUBLIC_API_KEY = "DAAEE6C2B76A2B743DF61F4EA7218";
const base_url = "https://react-mentions-mock.fly.dev";

const refreshData = async () => {
  const res = await fetch(`${base_url}/regenerate`, {
    headers: {
      Authorization: `Bearer ${PUBLIC_API_KEY}`,
    },
  });
  const body = await res.json();
  return body.data;
};

const search = async (q) => {
  const res = await fetch(`${base_url}/search?query=${q}`);
  const body = await res.json();
  return body.data;
};

const getCaretPosition = () => {
  const e = document.getElementById("input");
  return (e && e.selectionStart) || 0;
};

const calculatePixelWidth = (s) => {
  const formattedS = s.replaceAll(" ", "&nbsp;");
  const text = document.createElement("span");
  document.body.appendChild(text);

  text.style.font = "Segui UI";
  text.style.fontSize = "24px";
  text.style.height = "auto";
  text.style.width = "auto";
  text.style.position = "absolute";
  text.style.whiteSpace = "no-wrap";
  text.innerHTML = formattedS;

  const width = text.clientWidth;
  document.body.removeChild(text);
  return width;
};

const SuggestionsBox = ({ suggestions, selectedSuggestion, setMention }) => {
  return (
    <li className="suggestions">
      {suggestions.map((suggestion, i) => (
        <div
          className={`suggestion-container ${
            i === selectedSuggestion ? "highlighted" : ""
          }`}
          key={i}
          onClick={() => {
            setMention(i);
          }}
        >
          <span className="suggestion">
            {suggestion.name} (
            {suggestion.role.charAt(0).toUpperCase() + suggestion.role.slice(1)}
            )
          </span>
        </div>
      ))}
    </li>
  );
};

const App = () => {
  const [loading, setLoading] = useState(false);
  const [caretPos, setCaretPos] = useState(-1);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [mentions, setMentions] = useState([]);

  const handleMentionDelete = (oldText, newText) => {
    const oldLength = oldText.length;
    const newLength = newText.length;
    const isDelete = oldLength > newLength;
    const modifiedRange = [
      isDelete ? getCaretPosition() : caretPos,
      (isDelete ? getCaretPosition() : caretPos) +
        Math.max(0, oldLength - newLength),
    ];
    let insertedText = "";
    let [minMentionStart, maxMentionEnd] = modifiedRange;
    const toDeleteMentions = [];

    for (let i = 0; i < mentions.length; i++) {
      if (
        mentions[i].startIndex < modifiedRange[1] &&
        mentions[i].endIndex > modifiedRange[0]
      ) {
        minMentionStart = Math.min(minMentionStart, mentions[i].startIndex);
        maxMentionEnd = Math.max(maxMentionEnd, mentions[i].endIndex);

        insertedText = newText.substring(
          getCaretPosition() - newLength + oldLength,
          getCaretPosition()
        );

        toDeleteMentions.push(i);
      }
    }

    if (isDelete) {
      newText =
        oldText.slice(0, Math.min(modifiedRange[0], minMentionStart)) +
        oldText.slice(Math.max(maxMentionEnd, modifiedRange[1]));
      setText(newText);
    } else if (insertedText !== "") {
      newText =
        oldText.slice(0, Math.min(modifiedRange[0], minMentionStart)) +
        insertedText +
        oldText.slice(Math.max(maxMentionEnd, modifiedRange[1]));
      setText(newText);
    }

    const newMentions = mentions.filter(
      (_, i) => !toDeleteMentions.includes(i)
    );
    setMentions(newMentions);
    return [newText, newMentions];
  };

  const handleMentionShift = (oldText, newText, newMentions) => {
    const oldLength = oldText.length;
    const newLength = newText.length;

    for (let i = 0; i < newMentions.length; i++) {
      if (newMentions[i].startIndex >= caretPos) {
        newMentions[i].startIndex += newLength - oldLength;
        newMentions[i].endIndex += newLength - oldLength;
        newMentions[i].offset = calculatePixelWidth(
          newText.slice(0, newMentions[i].startIndex)
        );
      }
    }

    setMentions(newMentions);
  };

  const handleChange = (e) => {
    checkCaretPos();
    setText(e.target.value);

    const [newText, newMentions] = handleMentionDelete(text, e.target.value);
    handleMentionShift(text, newText, newMentions);
  };

  const setMention = (i) => {
    const mentionStart = text.lastIndexOf("@", caretPos - 1);

    const mentionWidth = calculatePixelWidth(suggestions[i].name);
    const mentionOffset = calculatePixelWidth(text.slice(0, mentionStart));
    const newMentions = [
      ...mentions,
      {
        role: suggestions[i].role,
        startIndex: mentionStart,
        endIndex: mentionStart + suggestions[i].name.length,
        offset: mentionOffset,
        width: mentionWidth,
      },
    ];
    const newText =
      text.slice(0, mentionStart) + suggestions[i].name + text.slice(caretPos);

    setMentions(newMentions);
    setText(newText);
    handleMentionShift(text, newText, newMentions);

    setModalOpen(false);
  };

  const checkCaretPos = () => {
    setCaretPos(getCaretPosition());
  };

  const handleKeyDown = (e) => {
    checkCaretPos();
    // arrow up/down button should select next/previous list element
    if (e.keyCode === 38) {
      e.preventDefault();
      setSelectedSuggestion((prev) => Math.max(0, prev - 1));
    } else if (e.keyCode === 40) {
      e.preventDefault();
      setSelectedSuggestion((prev) =>
        Math.min(suggestions.length - 1, prev + 1)
      );
    }
    // enter/return should select the current list element
    else if (e.keyCode === 13 || e.keyCode === 9) {
      e.preventDefault();
      setMention(selectedSuggestion);
    }
  };

  useEffect(() => {
    const mentionStart = text.lastIndexOf("@", caretPos - 1);
    if (mentionStart === -1 || caretPos === -1) {
      setModalOpen(false);
      return;
    } else {
      setModalOpen(true);
    }

    const query = text.substring(mentionStart + 1, caretPos);
    const searchQuery = async () => {
      const data = await search(query);
      return data;
    };
    searchQuery().then((data) => {
      if (data) {
        setSuggestions(data);
      }
    });
  }, [caretPos, text]);

  useEffect(() => {
    setSelectedSuggestion(0);
  }, [suggestions]);

  return (
    <div
      className="center"
      style={{ height: "100vh", flexDirection: "column" }}
    >
      <div>
        <h1 className="header">React Mentions Mock</h1>
      </div>
      <div style={{ flexDirection: "column" }}>
        <div className="center">
          <div style={{ position: "relative" }}>
            <input
              id="input"
              className="textbox"
              placeholder="Mention people using '@'"
              value={text}
              onClick={checkCaretPos}
              onKeyDown={handleKeyDown}
              onChange={handleChange}
            ></input>
            {mentions.map((mention, i) => (
              <div key={i} className="mention-container">
                <div
                  className="mention"
                  style={{
                    marginLeft: mention.offset,
                    width: mention.width,
                    backgroundColor:
                      mention.role === "customer"
                        ? "rgba(	73, 116, 230, 0.5)"
                        : "rgba(200, 50, 50, 0.3)",
                  }}
                />
              </div>
            ))}
          </div>
          <button
            className="button"
            onClick={() => {
              setLoading(true);
              const refresh = async () => {
                const data = await refreshData();
                return data;
              };
              refresh().then((data) => {
                setLoading(false);
              });
            }}
          >
            {loading ? (
              <ScaleLoader
                color={"white"}
                loading={loading}
                height={20}
                width={5}
                aria-label="Loading Spinner"
                data-testid="loader"
              />
            ) : (
              <span>Regenerate</span>
            )}
          </button>
        </div>
        {modalOpen && (
          <SuggestionsBox
            suggestions={suggestions}
            selectedSuggestion={selectedSuggestion}
            setMention={setMention}
          />
        )}
      </div>
    </div>
  );
};

export default App;
