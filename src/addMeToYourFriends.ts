import { html, TemplateResult } from "lit-html";
import { styleMap } from "lit-html/directives/style-map";
import { DataBrowserContext, LiveStore } from "pane-registry";
import { rdf, widgets, authn, ns } from "solid-ui";
import { complain, mention, clearPreviousMessage } from "./addMeToYourFriendsHelper";
import { padding, textCenter } from "./baseStyles";
import {
  logInAddMeToYourFriendsButtonText,
  friendExistsAlreadyButtonText,
  addMeToYourFriendsButtonText,
  friendWasAddedSuccesMessage,
  userNotLoggedInErrorMessage,
  friendExistsMessage,
  internalErrorMessage,
} from "./texts";

let buttonContainer = <HTMLDivElement>document.createElement("div");

//panel local style
const styles = {
  button: styleMap({ ...textCenter(), ...padding() }),
};

const addMeToYourFriendsDiv = (
  subject: rdf.NamedNode,
  context: DataBrowserContext
): TemplateResult => {
  buttonContainer = context.dom.createElement("div");
  const button = createAddMeToYourFriendsButton(subject, context);
  buttonContainer.appendChild(button);
  return html` <div style="${styles.button}">${buttonContainer}</div> `;
};

const createAddMeToYourFriendsButton = (
  subject: rdf.NamedNode,
  context: DataBrowserContext
): HTMLButtonElement => {
  const button = widgets.button(
    context.dom,
    undefined,
    logInAddMeToYourFriendsButtonText,
    setButtonHandler, //sets an onclick event listener
    {
      needsBorder: true,
    }
  );
  //this is to make clear which style we have, for code readability
  //not logged in
  button.setAttribute("class", "textButton-0-1-3"); //style of 'Primary' UI button with needsBorder=true

  button.refresh = refreshButton();
  
  function setButtonHandler(event) {
    event.preventDefault();
    saveNewFriend(subject, context)
    .then(() => {
      clearPreviousMessage(buttonContainer);
      mention(buttonContainer, friendWasAddedSuccesMessage);
      refreshButton();
    })
    .catch(error => {
      clearPreviousMessage(buttonContainer);
      //else UI.widgets.complain(buttonContainer, message); //displays an error message at the top of the window
      complain(buttonContainer, context, error);
    });
  }
  
  function refreshButton() {
     const me = authn.currentUser();
     const store = context.session.store;
    
    if (checkIfAnyUserLoggedIn(me)) {
      checkIfFriendExists(store, me, subject).then((friendExists) => {
        if (friendExists) {
          //logged in and friend exists or friend was just added
          button.innerHTML = friendExistsAlreadyButtonText.toUpperCase();
          button.setAttribute("class", "textButton-0-1-3"); //style of 'Primary' UI button with needsBorder=true
        } else {
          //logged in and friend does not exist yet
          button.innerHTML = addMeToYourFriendsButtonText.toUpperCase();
          button.setAttribute("class", "textButton-0-1-2"); //style of 'Primary' UI button with needsBorder=false
        }
      });
    }
  }

  return button;
};

async function saveNewFriend(subject: rdf.NamedNode, context: DataBrowserContext): Promise<void> {
  const me = authn.currentUser();
  const store = context.session.store;

  if (checkIfAnyUserLoggedIn(me)) {
    if (!(await checkIfFriendExists(store, me, subject))) {
      //if friend does not exist, we add her/him
      await store.fetcher.load(me);
      const updater = store.updater;
      const toBeInserted = [rdf.st(me, ns.foaf("knows"), subject, me.doc())];
      try {
        await updater.update([], toBeInserted);
      } catch (error) {
        let errorMessage = error;
        if (errorMessage.toString().includes("Unauthenticated"))
          errorMessage = userNotLoggedInErrorMessage;
        throw new Error(errorMessage);
      }
    } else throw new Error(friendExistsMessage);
  } else throw new Error(userNotLoggedInErrorMessage);
}

function checkIfAnyUserLoggedIn(me: rdf.NamedNode): boolean {
  if (me) return true;
  else return false;
}

async function checkIfFriendExists(
  store: LiveStore,
  me: rdf.NamedNode,
  subject: rdf.NamedNode
): Promise<boolean> {
  await store.fetcher.load(me);
  if (store.whether(me, ns.foaf("knows"), subject, me.doc()) === 0) return false;
  else return true;
}

//Because the code has unhandled Promises we still want to signal the user a message.
//Console will contain actual error.
window.addEventListener("unhandledrejection", function () {
  clearPreviousMessage(buttonContainer);
  buttonContainer.appendChild(widgets.errorMessageBlock(window.document, internalErrorMessage));
});

export {
  addMeToYourFriendsDiv,
  createAddMeToYourFriendsButton,
  saveNewFriend,
  checkIfAnyUserLoggedIn,
  checkIfFriendExists,
};
