// Annotorious integration
import { createImageAnnotator } from '@annotorious/annotorious';

// HTML template for the control
const template = document.createElement('template');
template.innerHTML = `
  <div class="image-wrapper">
    <img class="annotatable-image" />
  </div>
`;

function safeRaisePropertyChanged(ctrl, prop) {
  if (window.K2 && typeof window.K2.RaisePropertyChanged === 'function') {
    window.K2.RaisePropertyChanged(ctrl, prop);
  } else {
    console.log('[image-annotation] Property changed:', prop, '=', ctrl[prop]);
  }
}

// Make sure we only define once (design + runtime both use control.js)
if (!window.customElements.get('image-annotation')) {
  window.customElements.define('image-annotation', class ImageAnnotation extends HTMLElement {
    constructor() {
      super();

      this._src = '';
      this._value = [];          // Internal: array of annotations
      this._hasRendered = false;
      this._anno = null;
      this._onAnnoChange = null; // reference to event handler
      this._selectedAnnotation = null;

      // basic support flags
      this._height = '';
      this._width = '';
      this._isVisible = true;
      this._isEnabled = true;
      this._isReadOnly = false;

      // UI bits we’ll create at runtime
      this.editor = null;
      this.editorTextarea = null;
      this.deleteBtn = null;
    }

    // Attributes we might care about
    static get observedAttributes() {
      return ['src'];
    }

    attributeChangedCallback(name, oldVal, newVal) {
      if (name === 'src' && oldVal !== newVal) {
        this._src = newVal || '';
        if (this.img) {
          this.img.src = this._src;
        }
      }
    }

    async connectedCallback() {
      if (this._hasRendered) return;

      // Render template
      this.appendChild(template.content.cloneNode(true));

      // Grab references
      this.img = this.querySelector('.annotatable-image');
      this.imageWrapper = this.querySelector('.image-wrapper');

      // Make sure wrapper is positioned for overlays
      if (this.imageWrapper) {
        this.imageWrapper.style.position = 'relative';
      }

      // Initial image src
      this._src = this._src || this.getAttribute('src') || this._src;
      if (this._src) {
        this.img.src = this._src;
      }

      // Apply initial standard supports if they were set before render
      if (this._height) this.Height = this._height;
      if (this._width) this.Width = this._width;
      this.IsVisible = this._isVisible;
      this.IsEnabled = this._isEnabled;
      this.IsReadOnly = this._isReadOnly;

      // --- Text editor popup UI ---
      this._initTextEditorUI();

      // --- Delete button UI ---
      this._initDeleteButtonUI();

      // Give the inner <img> a unique ID so we can pass it to Annotorious
      const imgId = `anno-img-${Math.random().toString(36).slice(2)}`;
      this.img.id = imgId;

      // Initialize Annotorious
      this._anno = createImageAnnotator(imgId);

      // Central change handler: sync internal value + raise K2 events
      this._onAnnoChange = () => {
        this._syncFromAnno();
      };

      // If there is already a Value set before connectedCallback, render it
      if (Array.isArray(this._value) && this._value.length > 0 && this._anno.setAnnotations) {
        this._anno.setAnnotations(this._value, true); // replace=true
      }

      // Listen to user events (create/update/delete)
      if (this._anno.on) {
        this._anno.on('createAnnotation', this._onAnnoChange);
        this._anno.on('updateAnnotation', this._onAnnoChange);
        this._anno.on('deleteAnnotation', this._onAnnoChange);

        // Selection: drives popup + delete button
        this._anno.on('selectionChanged', (selection) => {
          const selected = (selection && selection.length) ? selection[0] : null;
          this._selectedAnnotation = selected;

          if (selected) {
            this._showTextEditor(selected);
          } else {
            this._hideTextEditor();
          }

          this._updateDeleteButtonVisibility();
        });
      }

      this._hasRendered = true;
      this.dispatchEvent(new Event('Rendered'));
    }

    disconnectedCallback() {
      if (this._anno) {
        if (this._onAnnoChange && this._anno.off) {
          this._anno.off('createAnnotation', this._onAnnoChange);
          this._anno.off('updateAnnotation', this._onAnnoChange);
          this._anno.off('deleteAnnotation', this._onAnnoChange);
        }
        if (this._anno.destroy) {
          this._anno.destroy();
        }
        this._anno = null;
      }
    }

    // ---- Internal helpers -------------------------------------------------

    _syncFromAnno() {
      if (!this._anno || !this._anno.getAnnotations) return;

      this._value = this._anno.getAnnotations() || [];

      const json = this.Value; // getter will stringify

      console.log('[image-annotation] annotations updated:', json);

      // Tell K2 the Value property changed
      safeRaisePropertyChanged(this, 'Value');

      // DOM change event for rules
      this.dispatchEvent(new Event('change', { bubbles: true }));

      // Custom "Changed" event (id = "Changed" in manifest)
      this.dispatchEvent(new CustomEvent('Changed', {
        detail: { value: json }
      }));
    }

    _initTextEditorUI() {
      if (!this.imageWrapper || this.editor) return;

      const editor = document.createElement('div');
      editor.className = 'anno-text-editor';
      editor.innerHTML = `
        <textarea class="anno-textarea" rows="2" placeholder="Add a comment"></textarea>
      `;
      editor.style.display = 'none';

      this.imageWrapper.appendChild(editor);
      this.editor = editor;
      this.editorTextarea = editor.querySelector('.anno-textarea');

      // Persist text into annotation bodies
      this.editorTextarea.addEventListener('input', () => {
        if (!this._selectedAnnotation) return;

        const text = this.editorTextarea.value;
        let bodies = this._selectedAnnotation.bodies || [];
        let body = bodies.find(b => b.purpose === 'commenting' || !b.purpose);

        if (text && text.trim()) {
          if (!body) {
            body = {
              id: (this._selectedAnnotation.id || 'anno') + '-body-' + Date.now(),
              purpose: 'commenting',
              value: text
            };
            bodies = bodies.concat([body]);
          } else {
            body.value = text;
          }
        } else if (body) {
          // Remove empty comment body
          bodies = bodies.filter(b => b !== body);
        }

        this._selectedAnnotation.bodies = bodies;

        if (this._anno && this._anno.updateAnnotation) {
          this._anno.updateAnnotation(this._selectedAnnotation);
        }

        // Keep K2 value in sync
        this._syncFromAnno();
      });
    }

    _showTextEditor(annotation) {
      if (!this.editor || !this.editorTextarea) return;

      const bodies = annotation.bodies || [];
      const textBody = bodies.find(b => b.purpose === 'commenting' || !b.purpose);
      this.editorTextarea.value = (textBody && textBody.value) ? textBody.value : '';

      this._positionTextEditor(annotation);
      this.editor.style.display = 'block';
    }

    _hideTextEditor() {
      if (!this.editor) return;
      this.editor.style.display = 'none';
    }

    _positionTextEditor(annotation) {
      if (!this.editor || !this.img) return;

      const selector = annotation && annotation.target && annotation.target.selector;
      const geometry = selector && selector.geometry;
      const bounds = geometry && geometry.bounds;

      if (!bounds || !this.img.naturalWidth || !this.img.naturalHeight) {
        // Fallback: bottom-left
        this.editor.style.left = '8px';
        this.editor.style.bottom = '8px';
        this.editor.style.top = 'auto';
        return;
      }

      const scaleX = this.img.clientWidth / this.img.naturalWidth;
      const scaleY = this.img.clientHeight / this.img.naturalHeight;

      const left = bounds.minX * scaleX;
      const top = bounds.maxY * scaleY + 4; // just below rectangle

      this.editor.style.left = `${left}px`;
      this.editor.style.top = `${top}px`;
      this.editor.style.bottom = 'auto';
    }

    _initDeleteButtonUI() {
      if (!this.imageWrapper || this.deleteBtn) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'anno-delete-button';
      btn.title = 'Delete annotation';
      btn.innerHTML = '🗑'; // you can swap for an SVG/icon
      btn.style.display = 'none';

      btn.addEventListener('click', () => {
        if (!this._selectedAnnotation || !this._anno) return;

        try {
          this._anno.removeAnnotation(this._selectedAnnotation);
        } catch (e) {
          console.warn('[image-annotation] Failed to remove annotation', e);
        }

        this._selectedAnnotation = null;
        this._hideTextEditor();
        this._updateDeleteButtonVisibility();
        this._syncFromAnno();
      });

      this.imageWrapper.appendChild(btn);
      this.deleteBtn = btn;
      this._updateDeleteButtonVisibility();
    }

    _updateDeleteButtonVisibility() {
      if (!this.deleteBtn) return;

      const canDelete = !!this._selectedAnnotation && this._isEnabled && !this._isReadOnly;
      this.deleteBtn.style.display = canDelete ? 'block' : 'none';
      this.deleteBtn.disabled = !canDelete;
    }

    // === SmartForm-style Contract ===
    // External K2 "Value" is a JSON string. Internal is an array.

    get Value() {
      try {
        return JSON.stringify(this._value || []);
      } catch (e) {
        return '[]';
      }
    }

    set Value(val) {
      let arr;

      if (typeof val === 'string') {
        if (!val.trim()) {
          arr = [];
        } else {
          try {
            arr = JSON.parse(val);
          } catch (e) {
            console.warn('image-annotation: Value must be JSON string or array of annotations.', e);
            return;
          }
        }
      } else if (Array.isArray(val)) {
        arr = val;
      } else {
        console.warn('image-annotation: Value must be JSON string or array of annotations.');
        return;
      }

      this._value = arr;

      // If Annotorious is already initialized, push into the viewer
      if (this._anno && this._anno.setAnnotations) {
        this._anno.setAnnotations(this._value, true); // replace existing
      }

      // Let K2 know the property changed
      safeRaisePropertyChanged(this, 'Value');
    }

    // === Image Source property from manifest ===
    // Manifest id: "imageSourceUrl"
    get imageSourceUrl() {
      return this._src;
    }

    set imageSourceUrl(v) {
      this._src = v || '';
      if (this.img) {
        this.img.src = this._src;
      } else {
        // If set before connectedCallback, stash it in an attribute
        this.setAttribute('src', this._src);
      }
    }

    // Optional PascalCase alias
    get ImageSourceUrl() {
      return this.imageSourceUrl;
    }
    set ImageSourceUrl(v) {
      this.imageSourceUrl = v;
    }

    // Convenience alias
    get Source() {
      return this._src;
    }
    set Source(v) {
      this.imageSourceUrl = v;
    }

    // === Standard supports from manifest ===

    get Height() { return this._height; }
    set Height(val) {
      this._height = val;
      const v = (val === undefined || val === null || val === '')
        ? ''
        : (isNaN(val) ? String(val) : `${val}px`);
      this.style.height = v;
    }

    get Width() { return this._width; }
    set Width(val) {
      this._width = val;
      const v = (val === undefined || val === null || val === '')
        ? ''
        : (isNaN(val) ? String(val) : `${val}px`);
      this.style.width = v;
    }

    get IsVisible() { return this._isVisible; }
    set IsVisible(val) {
      this._isVisible = (val === true || val === 'true');
      this.style.display = this._isVisible ? '' : 'none';
    }

    get IsEnabled() { return this._isEnabled; }
    set IsEnabled(val) {
      this._isEnabled = (val === true || val === 'true');
      if (this.imageWrapper) {
        this.imageWrapper.style.pointerEvents = this._isEnabled ? '' : 'none';
        this.imageWrapper.classList.toggle('is-disabled', !this._isEnabled);
      }
      this._updateDeleteButtonVisibility();
    }

    get IsReadOnly() { return this._isReadOnly; }
    set IsReadOnly(val) {
      this._isReadOnly = (val === true || val === 'true');
      if (this.imageWrapper) {
        // Block pointer events when read-only
        this.imageWrapper.style.pointerEvents = this._isReadOnly ? 'none' : '';
        this.imageWrapper.classList.toggle('is-readonly', this._isReadOnly);
      }
      this._updateDeleteButtonVisibility();
    }
  });
}
