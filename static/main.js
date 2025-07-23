class ValidationHandler extends HTMLElement {
  static tagName = "val-handler";
  static attrs = {
    form: "form",
    defaultErrorLocation: "default-error-location", 
  };

  #controller;
  #inputFieldNames;
  #errorElementMap;

  constructor() {
    super();
    this.#controller = new AbortController();
    this.#inputFieldNames = [];
    this.#errorElementMap = new Map();
  }

  #putError(fieldName, message) {
    const errorLocation = this.#errorElementMap.get(fieldName);
    errorLocation.textContent = message;
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

  get #form() {
    return document.querySelector(this.form);
  }

  connectedCallback() {
    const form = this.#form;
    if (form === null) {
      console.error(`Form element '${this.form}' not found.`);
      return;
    }

    const inputFields = Array.from(form.querySelectorAll("input, select, textarea"));

    for (const inputField of inputFields) {
      this.#inputFieldNames.push(inputField.name);
      // TODO split and search for one with error suffix
      const errorElementRef = inputField.getAttribute("aria-describedby");
      const errorElement = document.getElementById(errorElementRef ?? `${fieldName}-error`);
      this.#errorElementMap.set(inputField.name, errorElement);
    }

    form.addEventListener("val-error", (event) => {
      console.log("[ValidationHandler] errors:", event.detail);
      const { location, message } = event.detail;
      this.#putError(location, message);
    }, { signal: this.#controller.signal });
    
    form.addEventListener("val-success", (event) => {
      console.log("[ValidationHandler] success:", event.detail);
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

      const fields = [];
      for (const inputField of inputFields) {
        fields.push(inputField.checkValidity());
      }
      // Prevent form from submitting because 'novalidate' was added
      for (const valid of fields) {
        if (!valid) {
          event.preventDefault();
          break;
        }
      }
    });

    for (const inputField of inputFields) {
      inputField.addEventListener(this.#validateOn, ValidationSetup.#validateAndEmit, { signal: this.#controller.signal });
      inputField.addEventListener("invalid", ValidationSetup.#validateAndEmit, { signal: this.#controller.signal });
    }
  }

  disconnectedCallback() {
    this.#controller.abort();
  }

  static #validateAndEmit(event) {
    if (event.target.validity.valid) {
      ValidationSetup.#success(event.target, event.target.getAttribute("data-val-server") !== null);
      return;
    }

    const { validity } = event.target;
    if (validity.valueMissing) {
      const message = event.target.getAttribute("data-val-required") ?? event.target.validationMessage;
      ValidationSetup.#error(event.target, message);
      return;
    }
    if (validity.customError) {
      const message = event.target.getAttribute("data-val-customValidity") ?? event.target.validationMessage;
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
  * @property { boolean } [validateOnServer]
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

  static #success(element, validateOnServer = false) {
    element.dispatchEvent(
      ValidationSetup.#emit("val-success", {
        location: element.id,
        validateOnServer,
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

form.addEventListener("submit", (event) => {
  console.log("[form] Submit triggered:", event);
});
