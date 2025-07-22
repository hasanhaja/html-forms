class ValidationHandler extends HTMLElement {
  static tagName = "validation-handler";
  // TODO Add observe
  static attrs = {
    form: "form",
    defaultErrorLocation: "default-error-location", 
  };
  
  #controller;
  #inputFieldNames;

  constructor() {
    super();
    this.#controller = new AbortController();
    this.#inputFieldNames = [];
  }

  #putError(fieldName, message) {
    const errorLocation = document.getElementById(`${fieldName}-error`); 
    errorLocation.textContent = message;
  }

  #clearError(fieldName) {
    const errorLocation = document.getElementById(`${fieldName}-error`); 
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
    }

    form.addEventListener("validation-error", (event) => {
      console.log("[ValidationHandler] errors:", event.detail);
      const { location, message } = event.detail;
      this.#putError(location, message);
    }, { signal: this.#controller.signal });
    
    form.addEventListener("validation-success", (event) => {
      const { location, message } = event.detail;
      this.#clearError(location);
    }, { signal: this.#controller.signal });
    
    form.addEventListener("submit", (event) => {
      this.#clearErrors();
    }, { signal: this.#controller.signal });
  }

  disconnectedCallback() {
    this.#controller.abort();
  }
}


class ValidationConfigure extends HTMLElement {
  static tagName = "validation-configure";
  // TODO listen for slot changed and re-register all inputs
  // TODO Add observe
  static attrs = {
    form: "form",
    validationMethod: "validation-method", 
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

  get #validationMethod() {
    return this.getAttribute(ValidationConfigure.attrs.validationMethod) ?? "blur";
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

    for (const inputField of inputFields) {
      inputField.addEventListener(this.#validationMethod, (event) => {
        console.log("[DEBUG] Validity:", event.target.validity);
        if (event.target.validity.valid) {
          ValidationConfigure.#success(event.target);
          return;
        }
        console.log("[DEBUG] Message:", event.target.validationMessage);
        ValidationConfigure.#error(event.target, event.target.validationMessage);
      }, { signal: this.#controller.signal });
    }
  }

  disconnectedCallback() {
    this.#controller.abort();
  }

  /**
  * @typedef { Object } Validity
  * @property { string } [message]
  * @property { string } location
  */

  /**
    * @param { "validation-error" | "validation-success" } type
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
      ValidationConfigure.#emit("validation-error", {
        message,
        location: element.id,
      })
    );
  }

  static #success(element) {
    element.dispatchEvent(
      ValidationConfigure.#emit("validation-success", {
        location: element.id,
      })
    );
  }
}

customElements.define(ValidationConfigure.tagName, ValidationConfigure);
customElements.define(ValidationHandler.tagName, ValidationHandler);

const form = document.querySelector("form");

form.addEventListener("submit", (event) => {
  console.log("[form] Submit triggered:", event);
  event.preventDefault();
});
