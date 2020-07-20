export default {
  name: "genre",
  fields: {
    name: {
      type: String,
      required: true,
    },

    // A model can reference itself.
    parentGenre: "genre",
  },
};
