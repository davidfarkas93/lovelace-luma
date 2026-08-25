import type { Preview } from "@storybook/web-components-vite";
import "../storybook/ha-elements";
import "../storybook/story-host";
import "../storybook/storybook.css";

const preview: Preview = {
  globalTypes: {
    locale: {
      description: "Home Assistant locale",
      defaultValue: "en",
      toolbar: {
        icon: "globe",
        items: [
          { value: "en", title: "English" },
          { value: "hu", title: "Magyar" },
        ],
      },
    },
  },
  decorators: [
    (story, context) => {
      document.documentElement.lang = String(context.globals.locale || "en");
      return story();
    },
  ],
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      expanded: true,
      sort: "requiredFirst",
    },
    backgrounds: {
      default: "Luma light",
      values: [
        { name: "Luma light", value: "#f7f7fb" },
        { name: "Luma dark", value: "#15161d" },
      ],
    },
    viewport: {
      options: {
        mobile: { name: "Mobile", styles: { width: "390px", height: "844px" } },
        tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop", styles: { width: "1280px", height: "800px" } },
      },
    },
    layout: "centered",
  },
};

export default preview;
