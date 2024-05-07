/* globals Croquet */

let elements = {};

let userColor = randomColor();

let joinButtonPressed = false;

let userInfo = {};
let createdRandomName;

export function load() {
    [
        "panel", "nickname", "title", "welcome",//, "mic", "video"
        "settings", "settingsMenu", //"videoList", "audioList", "videoPreview", "audioPreview",
        "joinButton", "required", "initials", "browserCheck", //"streamErrorMessage",
        "defaultWalletname", "walletname"
    ].forEach((n) => {
        let element = document.querySelector("#" + n);
        elements[n] = element;
    });

    ["blur", "keyup", "input", "keydown", "paste", "copy", "cut", "mouseup"].forEach((e) => {
        elements.nickname.addEventListener(e, updateNick);
        elements.walletname.addEventListener(e, updateWallet);
    });

    initHash();
    checkLocalStorage();
    setNick();
    setWallet();
    setWelcome();
    updateNick();
    updateWallet();

    setResizer();
}

function greenlightLoader(dirPath) {
    return new Promise((resolve, _reject) => {
        if (document.querySelector("#greenlightLoader")) {
            return resolve();
        }
        let script = document.createElement("script");
        script.id = "greenlightLoader";
        script.src = dirPath;
        script.type = "module";
        document.body.appendChild(script);
        script.onload = () => {
            let loadGreenlight = window._loadGreenlight;
            let setPath = window._setPath;
            delete window._loadGreenlight;
            delete window._setPath;
            resolve({loadGreenlight, setPath});
        };
        script.onerror = () => {throw new Error("loader could not be loaded");};
        return script;
    });
}

function findGreenlight() {
    let location = window.location;
    let ind = location.pathname.lastIndexOf("/");
    let dir = location.pathname.slice(0, ind);
    let dirPath;
    dirPath = `${location.origin}${dir}/greenlight.js`;
    return greenlightLoader(dirPath).then((mod) => {
        let dInd = dirPath.lastIndexOf("/");
        let pDir = dirPath.slice(0, dInd);
        mod.setPath(pDir);
        return mod.loadGreenlight;
    });
}

function initHash() {
    Croquet.App.autoSession("q").then((sessionName) => {
        elements.title.textContent = sessionName;
    });
}

function checkLocalStorage() {
    if (window.localStorage) {
        try {
            let value = window.localStorage.getItem("userInfo");
            if (!value) {return;}
            value = JSON.parse(value);
            if (value.version !== "2") {return;}
            userInfo = value;
            console.log(userInfo);
        } catch (e) {
            console.log("error in reading from localStorage");
        }
    }
}

function setNick() {
    let nickname;
    if (userInfo && userInfo.nickname) {
        nickname = userInfo.nickname;
    } else {
        nickname = randomName();
        createdRandomName = nickname;
    }
    elements.nickname.textContent = nickname;
}

function setWallet() {
    let walletname;

    if (userInfo && userInfo.walletname) {
        walletname = userInfo.walletname;
    } else {
        walletname = "public";
    }

    elements.walletname.textContent = walletname;
}

function setWelcome() {
    if (userInfo && userInfo.nickname) {
        elements.welcome.textContent = "Welcome back!";
    }
}

function updateNick(evt) {
    let nickname = elements.nickname;
    if (evt && evt.type === "keyup" && evt.key === "Enter") {
        let text = nickname.textContent;
        text = Array.from(text).filter((c) => c !== "\n" && c !== "\r");
        nickname.textContent = text.join("");

        if (nickname.textContent.length !== 0) {
          console.log("nick changed");
          userInfo.nickname = nickname.textContent;
            join();
            return;
        }
    }

    let joinState = nickname.textContent.length === 0 ? "Inactive" : "Active";

    elements.initials.textContent = initialsFrom(nickname.textContent);
    setState(elements.joinButton, joinState);
}

function updateWallet() {
    if (elements.walletname.textContent.length === 0) {
        elements.defaultWalletname.style.setProperty("display", "inherit");
        elements.walletname.style.setProperty("margin-left", "0px");
    } else {
        elements.defaultWalletname.style.setProperty("display", "none");
        elements.walletname.style.setProperty("margin-left", "8px");
    }
}

function initialsFrom(nickname) {
    if (!nickname) {
        return "";
    }

    let pieces = nickname.split(" ").filter(p => p.length > 0);

    if (pieces.length === 0) {
        return "";
    } if (pieces.length === 1) {
        return pieces[0].slice(0, 2).toUpperCase();
    }

    let name = pieces.map(p => p[0]);
    name = name[0] + name.slice(-1);
    return name.toUpperCase();
}

function resizer() {
    if (window.innerWidth >= 512 && window.innerHeight >= 720) {
        elements.panel.style.removeProperty("transform");
        return;
    }

    let ratio = Math.min(window.innerWidth / 512, window.innerHeight / 720) * 0.9;

    elements.panel.style.setProperty("transform", `scale(${ratio})`);
    elements.panel.style.setProperty("transform-origin", `top left`);
}

function setResizer() {
    window.addEventListener("resize", resizer);
    resizer();
}

function setButtonState(button, state, isLarge) {
    let newIcon = `img-${button.id}-${state}`;
    let newBack = "transparent";

    button.setAttribute("state", state);
    button.style.setProperty("background", newBack);

    let viewBox = isLarge ? `viewBox="0 0 40 40"` : `viewBox="0 0 24 24"`;
    let html = `<svg class="icon" ${viewBox}><use href="#${newIcon}"></use></svg>`;
    button.innerHTML = html;
}

function setState(button, state) {
    if (state === "Inactive") {
        button.onclick = null;
    } else {
        button.onclick = join;
    }
    button.setAttribute("state", state);
}

// function showStreramErrorMessage() {
//     elements.streamErrorMessage.style.setProperty("visibility", "inherit");
// }

function join() {
    joinButtonPressed = true;
    console.log(
        "pressed",
        elements.nickname.textContent,
        elements.initials.textContent,
        elements.walletname.textContent || "public");

    ["#landing-svg", "#landing-background", "#landing-style"].forEach(n => {
        let elem = document.querySelector(n);
        if (elem) {
            elem.remove();
        }
    });

    let root = document.querySelector("#croquet-root");
    if (root) {
        root.style.setProperty("display", "inherit");
    }

    let nickname = elements.nickname.textContent;
    let walletname = elements.walletname.textContent || "public";
    let initials = elements.initials.textContent;
    let sessionName = elements.title.textContent;
    let options = {
        nickname, walletname, initials, userColor, sessionName,
        boardName: sessionName
    };

    if (createdRandomName !== options.nickname) {
        let store = {version: "2", ...options};
        if (window.localStorage) {
            try {
                window.localStorage.setItem("userInfo", JSON.stringify(store));
            } catch (e) {
                console.log("error in writing to localStorage");
            }
        }
    }

    window.fromLandingPage = options;

    delete window.landingLoader;
    let script = document.getElementById("landingLoader");
    if (script) {script.remove();}

    findGreenlight().then((loadGreenlight) => {
        loadGreenlight(() => {
            window.document.title = `G: ${sessionName || ""}`;
            window.fromLandingPage = options;
        }, options, null);
    });
}

function randomColor() {
    let h = Math.random() * 360;
    let s = "40%";
    let l = "40%";
    return `hsl(${h}, ${s}, ${l})`;
}

function randomName() {
    let left = [
        "Admiring", "Adoring", "Affectionate", "Agitated", "Amazing", "Angry",
        "Awesome", "Beautiful", "Blissful", "Bold", "Boring", "Brave", "Busy",
        "Charming", "Clever", "Cool", "Compassionate", "Competent", "Condescending",
        "Confident", "Cranky", "Crazy", "Dazzling", "Determined", "Distracted",
        "Dreamy", "Eager", "Ecstatic", "Elastic", "Elated", "Elegant", "Eloquent",
        "Epic", "Exciting", "Fervent", "Festive", "Flamboyant", "Focused", "Friendly",
        "Frosty", "Funny", "Gallant", "Gifted", "Goofy", "Gracious", "Great", "Happy",
        "Hardcore", "Heuristic", "Hopeful", "Hungry", "Infallible", "Inspiring",
        "Interesting", "Intelligent", "Jolly", "Jovial", "Keen", "Kind", "Laughing",
        "Loving", "Lucid", "Magical", "Mystifying", "Modest", "Musing", "Naughty",
        "Nervous", "Nice", "Nifty", "Nostalgic", "Objective", "Optimistic", "Peaceful",
        "Pedantic", "Pensive", "Practical", "Priceless", "Quirky", "Quizzical",
        "Recursing", "Relaxed", "Reverent", "Romantic", "Sad", "Serene", "Sharp",
        "Silly", "Sleepy", "Stoic", "Strange", "Stupefied", "Suspicious", "Sweet",
        "Tender", "Thirsty", "Trusting", "Unruffled", "Upbeat", "Vibrant", "Vigilant",
        "Vigorous", "Wizardly", "Wonderful", "Xenodochial", "Youthful", "Zealous",
        "Zen"
    ];

    let right = [
        "Acorn", "Allspice", "Almond", "Ancho", "Anise", "Aoli", "Apple",
        "Apricot","Arrowroot","Asparagus","Avocado","Baklava","Balsamic",
        "Banana", "Barbecue", "Bacon", "Basil", "Bay Leaf", "Bergamot", "Blackberry",
        "Blueberry","Broccoli", "Buttermilk", "Cabbage", "Camphor", "Canaloupe",
        "Cappuccino", "Caramel", "Caraway", "Cardamom", "Catnip", "Cauliflower",
        "Cayenne", "Celery", "Cherry", "Chervil", "Chives", "Chipotle", "Chocolate",
        "Coconut", "Cookie Dough", "Chicory", "Chutney", "Cilantro", "Cinnamon",
        "Clove", "Coriander", "Cranberry", "Croissant", "Cucumber", "Cupcake", "Cumin",
        "Curry", "Dandelion", "Dill", "Durian", "Eclair", "Eggplant", "Espresso",
        "Felafel","Fennel", "Fenugreek", "Fig", "Garlic", "Gelato", "Gumbo",
        "Honeydew", "Hyssop", "Ghost Pepper",
        "Ginger", "Ginseng", "Grapefruit", "Habanero", "Harissa", "Hazelnut",
        "Horseradish", "Jalepeno", "Juniper", "Ketchup", "Key Lime", "Kiwi",
        "Kohlrabi", "Kumquat", "Latte", "Lavender", "Lemon Grass", "Lemon Zest",
        "Licorice", "Macaron", "Mango", "Maple Syrup", "Marjoram", "Marshmallow",
        "Matcha", "Mayonnaise", "Mint", "Mulberry", "Mustard", "Nectarine", "Nutmeg",
        "Olive Oil", "Orange Peel", "Oregano", "Papaya", "Paprika", "Parsley",
        "Parsnip", "Peach", "Peanut", "Pecan", "Pennyroyal", "Peppercorn", "Persimmon",
        "Pineapple", "Pistachio", "Plum", "Pomegranate", "Poppy Seed", "Pumpkin",
        "Quince", "Ragout", "Raspberry", "Ratatouille", "Rosemary", "Rosewater",
        "Saffron", "Sage", "Sassafras", "Sea Salt", "Sesame Seed", "Shiitake",
        "Sorrel", "Soy Sauce", "Spearmint", "Strawberry", "Strudel", "Sunflower Seed",
        "Sriracha", "Tabasco", "Tamarind", "Tandoori", "Tangerine", "Tarragon",
        "Thyme", "Tofu", "Truffle", "Tumeric", "Valerian", "Vanilla", "Vinegar",
        "Wasabi", "Walnut", "Watercress", "Watermelon", "Wheatgrass", "Yarrow",
        "Yuzu", "Zucchini"
    ];

    let a = left[Math.floor(Math.random() * left.length)];
    let b = right[Math.floor(Math.random() * right.length)];
    return `${a} ${b}`;
}
