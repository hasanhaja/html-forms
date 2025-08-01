class ValidationHandler extends HTMLElement {
  static tagName = "val-handler";
  static attrs = {
    form: "form",
    defaultErrorLocation: "default-error-location", 
  };

  #controller;
  #inputFieldNames;
  #errorElementMap;
  #defaultErrorElement;

  constructor() {
    super();
    this.#controller = new AbortController();
    this.#inputFieldNames = [];
    this.#errorElementMap = new Map();
  }

  #putError(fieldName, message) {
    const errorLocation = this.#errorElementMap.get(fieldName);
    if (errorLocation) {
      errorLocation.textContent = message;
    } else {
      this.#defaultErrorElement.textContent = message;
    }
  }

  #clearError(fieldName) {
    const errorLocation = this.#errorElementMap.get(fieldName);
    errorLocation.textContent = null;
  }

  #clearErrors() {
    for (const fieldName of this.#inputFieldNames) {
      this.#clearError(fieldName);
    }
  }

  get form() {
    return this.getAttribute(ValidationHandler.attrs.form);
  }

  get defaultErrorLocation() {
    return this.getAttribute(ValidationHandler.attrs.defaultErrorLocation);
  }

  get #form() {
    return document.querySelector(this.form);
  }

  connectedCallback() {
    const form = this.#form;
    if (form === null) {
      console.error(`Form element '${this.form}' not found.`);
      return;
    }
    this.#defaultErrorElement = document.querySelector(this.defaultErrorLocation);

    const inputFields = Array.from(form.querySelectorAll("input, select, textarea"));

    for (const inputField of inputFields) {
      this.#inputFieldNames.push(inputField.name);
      // TODO split and search for one with error suffix
      const errorElementRef = inputField.getAttribute("aria-describedby");
      const errorElement = document.getElementById(errorElementRef ?? `${inputField.name}-error`);
      if (errorElement) {
        this.#errorElementMap.set(inputField.name, errorElement);
      }
    }

    form.addEventListener("val-error", (event) => {
      const { location, message } = event.detail;
      this.#putError(location, message);
    }, { signal: this.#controller.signal });
    
    form.addEventListener("val-success", (event) => {
      const { location, message } = event.detail;
      this.#clearError(location);
    }, { signal: this.#controller.signal });
    
    form.addEventListener("val-submit", (event) => {
      this.#clearErrors();
    }, { signal: this.#controller.signal });
  }

  disconnectedCallback() {
    this.#controller.abort();
  }
}

class ValidationSetup extends HTMLElement {
  static tagName = "val-setup";
  static attrs = {
    form: "form",
    validateOn: "validate-on",
    valAction: "val-action",
  };

  #controller;
  #inputFieldNames;

  constructor() {
    super();
    this.#controller = new AbortController();
    this.#inputFieldNames = [];
  }

  get form() {
    return this.getAttribute(ValidationHandler.attrs.form);
  }

  get #form() {
    return document.querySelector(this.form);
  }

  get #validateOn() {
    return this.getAttribute(ValidationSetup.attrs.validateOn) ?? "blur";
  }

  get valAction() {
    return this.getAttribute(ValidationSetup.attrs.valAction) ?? "";
  }

  connectedCallback() {
    const form = this.#form;
    if (form === null) {
      console.error(`Form element '${this.form}' not found.`);
      return;
    }

    if (form.getAttribute("novalidate") === null) {
      form.setAttribute("novalidate", "");
    }

    const inputFields = Array.from(form.querySelectorAll("input, select, textarea"));

    form.addEventListener("submit", (event) => {
      ValidationSetup.#submit(event.target);

      for (const inputField of inputFields) {
        const valid = inputField.checkValidity();
        if (!valid) {
          event.preventDefault();
          break;
        }
      }
    });

    for (const inputField of inputFields) {
      inputField.addEventListener(this.#validateOn, ValidationSetup.#validateAndEmit.bind(this), { signal: this.#controller.signal });
      inputField.addEventListener("invalid", ValidationSetup.#validateAndEmit.bind(this), { signal: this.#controller.signal });
    }
  }

  disconnectedCallback() {
    this.#controller.abort();
  }

  static #validateAndEmit(event) {
    if (event.target.validity.valid) {
      if (event.target.getAttribute("data-val-server") !== null) {
        const params = new URLSearchParams([
          ["field", event.target.name],
          ["value", event.target.value],
        ]);
        const validateUrl = new URL(`${this.valAction}?${params}`, document.URL);

        fetch(validateUrl)
          .then((res) => res.json())
          .then((data) => {
            if (data.valid) {
              ValidationSetup.#success(event.target);
            } else {
              ValidationSetup.#error(event.target, data.message);
            }
          })
          .catch((_) => {
            console.error("Server response is not JSON with valid and message properties");
            ValidationSetup.#error(event.target, `Server response is not valid JSON. Example response, ${JSON.stringify({valid: false, message: "Enter a valid email"})}`);
          });
        return;
      }
      ValidationSetup.#success(event.target);
      return;
    }

    const { validity } = event.target;
    if (validity.customError) {
      const message = event.target.validationMessage;
      ValidationSetup.#error(event.target, message);
      return;
    }
    if (validity.valueMissing) {
      const message = event.target.getAttribute("data-val-required") ?? event.target.validationMessage;
      ValidationSetup.#error(event.target, message);
      return;
    }
    if (validity.patternMismatch) {
      const message = event.target.getAttribute("data-val-pattern") ?? event.target.validationMessage;
      ValidationSetup.#error(event.target, message);
      return;
    }
    if (validity.badInput || validity.typeMismatch) {
      const message = event.target.getAttribute("data-val-type") ?? event.target.validationMessage;
      ValidationSetup.#error(event.target, message);
      return;
    }
    if (validity.rangeOverflow) {
      const message = event.target.getAttribute("data-val-max") ?? event.target.validationMessage;
      ValidationSetup.#error(event.target, message);
      return;
    }
    if (validity.rangeUnderflow) {
      const message = event.target.getAttribute("data-val-min") ?? event.target.validationMessage;
      ValidationSetup.#error(event.target, message);
      return;
    }
    if (validity.tooLong) {
      const message = event.target.getAttribute("data-val-maxlength") ?? event.target.validationMessage;
      ValidationSetup.#error(event.target, message);
      return;
    }
    if (validity.tooShort) {
      const message = event.target.getAttribute("data-val-minlength") ?? event.target.validationMessage;
      ValidationSetup.#error(event.target, message);
      return;
    }
    if (validity.stepMismatch) {
      const message = event.target.getAttribute("data-val-step") ?? event.target.validationMessage;
      ValidationSetup.#error(event.target, message);
      return;
    }

    console.error("Unknown validity");
    ValidationSetup.#error(event.target, event.target.validationMessage);
  }

  /**
  * @typedef { object } Validity
  * @property { string } [message]
  * @property { string } [location]
  */

  /**
    * @param { "val-error" | "val-success" | "val-submit" } type
    * @param { Validity } data
    */
  static #emit(type, data) {
    const event = new CustomEvent(type, {
      detail: data,
      bubbles: true,
    });
    return event;
  }

  static #error(element, message) {
    element.dispatchEvent(
      ValidationSetup.#emit("val-error", {
        message,
        location: element.id,
      })
    );
  }

  static #success(element) {
    element.dispatchEvent(
      ValidationSetup.#emit("val-success", {
        location: element.id,
      })
    );
  }

  static #submit(element) {
    element.dispatchEvent(
      ValidationSetup.#emit("val-submit")
    );
  }
}

customElements.define(ValidationSetup.tagName, ValidationSetup);
customElements.define(ValidationHandler.tagName, ValidationHandler);

const form = document.querySelector("form");
const lastName = window["last-name"];

lastName.addEventListener("blur", (event) => {
  // Validate with the built-in constraints first
  event.target.setCustomValidity("");
  if (!event.target.validity.valid) {
    return;
  }

  // Then, extend with a custom constraints
  if (event.target.value.endsWith("an")) {
    event.target.setCustomValidity("Enter a last name that does not end in 'an'");
    // Trigger 'invalid' event
    event.target.checkValidity();
  }
});

form.addEventListener("submit", (event) => {
  console.log("[form] Submit triggered:", event);
});
