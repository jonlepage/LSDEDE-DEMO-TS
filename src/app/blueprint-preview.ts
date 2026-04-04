/**
 * Blueprint preview button — small icon (top-left of canvas) that shows
 * a thumbnail of the scene's blueprint screenshot on hover, and opens
 * the full image in a new browser tab on click.
 */

const BLUEPRINT_IMAGES_BASE_PATH = import.meta.env.BASE_URL;

export interface BlueprintPreviewHandle {
  /** Update the preview for a different scene. Pass null to hide. */
  update(imageFileName: string | null): void;
  /** Remove from DOM entirely. */
  destroy(): void;
}

export function createBlueprintPreview(
  canvasContainer: HTMLElement,
): BlueprintPreviewHandle {
  let currentImagePath: string | null = null;

  // --- Button ---
  const button = document.createElement("button");
  button.id = "blueprint-preview-button";
  button.title = "View blueprint screenshot";
  button.innerHTML = "🗺️";

  // --- Thumbnail tooltip ---
  const thumbnail = document.createElement("div");
  thumbnail.id = "blueprint-preview-thumbnail";

  const thumbnailImage = document.createElement("img");
  thumbnailImage.alt = "Blueprint preview";
  thumbnail.appendChild(thumbnailImage);

  const thumbnailLabel = document.createElement("span");
  thumbnail.appendChild(thumbnailLabel);

  button.appendChild(thumbnail);
  canvasContainer.appendChild(button);

  // --- Hover: show/hide thumbnail ---
  button.addEventListener("mouseenter", () => {
    if (currentImagePath) {
      thumbnail.classList.add("visible");
    }
  });
  button.addEventListener("mouseleave", () => {
    thumbnail.classList.remove("visible");
  });

  // --- Click: open full image in new tab ---
  button.addEventListener("click", () => {
    if (currentImagePath) {
      window.open(currentImagePath, "_blank", "noopener,noreferrer");
    }
  });

  function update(imageFileName: string | null): void {
    if (imageFileName) {
      currentImagePath = BLUEPRINT_IMAGES_BASE_PATH + imageFileName;
      thumbnailImage.src = currentImagePath;
      thumbnailLabel.textContent = imageFileName;
      button.style.display = "";
    } else {
      currentImagePath = null;
      button.style.display = "none";
    }
    thumbnail.classList.remove("visible");
  }

  // Hidden by default until a scene provides an image.
  button.style.display = "none";

  return {
    update,
    destroy() {
      button.remove();
    },
  };
}
