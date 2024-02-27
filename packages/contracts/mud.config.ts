import { mudConfig } from "@latticexyz/world/register";

export default mudConfig({
  enums: {},
  tables: {
    Counter: {
      keySchema: {},
      valueSchema: "uint32",
    },
  },
  systems: {},
});
