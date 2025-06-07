/* eslint-disable */
/* biome-ignore format: generated file */

export type introspection_types = {
  Action: {
    kind: "OBJECT";
    name: "Action";
    fields: {
      capitals: {
        name: "capitals";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
            };
          };
        };
      };
      createdAt: {
        name: "createdAt";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      db_write_timestamp: {
        name: "db_write_timestamp";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
      };
      endTime: {
        name: "endTime";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "numeric"; ofType: null };
        };
      };
      id: {
        name: "id";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      instructions: {
        name: "instructions";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      media: {
        name: "media";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "SCALAR"; name: "String"; ofType: null };
            };
          };
        };
      };
      ownerAddress: {
        name: "ownerAddress";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      startTime: {
        name: "startTime";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "numeric"; ofType: null };
        };
      };
      title: {
        name: "title";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
    };
  };
  Action_bool_exp: {
    kind: "INPUT_OBJECT";
    name: "Action_bool_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_and";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "Action_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_not";
        type: { kind: "INPUT_OBJECT"; name: "Action_bool_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_or";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "Action_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "capitals";
        type: { kind: "INPUT_OBJECT"; name: "capital_array_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "createdAt";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "db_write_timestamp";
        type: { kind: "INPUT_OBJECT"; name: "timestamp_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "endTime";
        type: { kind: "INPUT_OBJECT"; name: "numeric_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "id";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "instructions";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "media";
        type: { kind: "INPUT_OBJECT"; name: "String_array_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "ownerAddress";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "startTime";
        type: { kind: "INPUT_OBJECT"; name: "numeric_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "title";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  Action_order_by: {
    kind: "INPUT_OBJECT";
    name: "Action_order_by";
    isOneOf: false;
    inputFields: [
      {
        name: "capitals";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "createdAt";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "db_write_timestamp";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "endTime";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      { name: "id"; type: { kind: "ENUM"; name: "order_by"; ofType: null }; defaultValue: null },
      {
        name: "instructions";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      { name: "media"; type: { kind: "ENUM"; name: "order_by"; ofType: null }; defaultValue: null },
      {
        name: "ownerAddress";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "startTime";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      { name: "title"; type: { kind: "ENUM"; name: "order_by"; ofType: null }; defaultValue: null },
    ];
  };
  Action_select_column: {
    name: "Action_select_column";
    enumValues:
      | "capitals"
      | "createdAt"
      | "db_write_timestamp"
      | "endTime"
      | "id"
      | "instructions"
      | "media"
      | "ownerAddress"
      | "startTime"
      | "title";
  };
  Action_stream_cursor_input: {
    kind: "INPUT_OBJECT";
    name: "Action_stream_cursor_input";
    isOneOf: false;
    inputFields: [
      {
        name: "initial_value";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "INPUT_OBJECT"; name: "Action_stream_cursor_value_input"; ofType: null };
        };
        defaultValue: null;
      },
      {
        name: "ordering";
        type: { kind: "ENUM"; name: "cursor_ordering"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  Action_stream_cursor_value_input: {
    kind: "INPUT_OBJECT";
    name: "Action_stream_cursor_value_input";
    isOneOf: false;
    inputFields: [
      {
        name: "capitals";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "createdAt";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "db_write_timestamp";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "endTime";
        type: { kind: "SCALAR"; name: "numeric"; ofType: null };
        defaultValue: null;
      },
      { name: "id"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      {
        name: "instructions";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "media";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "ownerAddress";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "startTime";
        type: { kind: "SCALAR"; name: "numeric"; ofType: null };
        defaultValue: null;
      },
      { name: "title"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
    ];
  };
  Boolean: unknown;
  Boolean_comparison_exp: {
    kind: "INPUT_OBJECT";
    name: "Boolean_comparison_exp";
    isOneOf: false;
    inputFields: [
      { name: "_eq"; type: { kind: "SCALAR"; name: "Boolean"; ofType: null }; defaultValue: null },
      { name: "_gt"; type: { kind: "SCALAR"; name: "Boolean"; ofType: null }; defaultValue: null },
      { name: "_gte"; type: { kind: "SCALAR"; name: "Boolean"; ofType: null }; defaultValue: null },
      {
        name: "_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "Boolean"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_is_null";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      { name: "_lt"; type: { kind: "SCALAR"; name: "Boolean"; ofType: null }; defaultValue: null },
      { name: "_lte"; type: { kind: "SCALAR"; name: "Boolean"; ofType: null }; defaultValue: null },
      { name: "_neq"; type: { kind: "SCALAR"; name: "Boolean"; ofType: null }; defaultValue: null },
      {
        name: "_nin";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "Boolean"; ofType: null };
          };
        };
        defaultValue: null;
      },
    ];
  };
  Garden: {
    kind: "OBJECT";
    name: "Garden";
    fields: {
      bannerImage: {
        name: "bannerImage";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      createdAt: {
        name: "createdAt";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      db_write_timestamp: {
        name: "db_write_timestamp";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
      };
      description: {
        name: "description";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      gardeners: {
        name: "gardeners";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "SCALAR"; name: "String"; ofType: null };
            };
          };
        };
      };
      id: {
        name: "id";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      location: {
        name: "location";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      name: {
        name: "name";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      operators: {
        name: "operators";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "SCALAR"; name: "String"; ofType: null };
            };
          };
        };
      };
      tokenAddress: {
        name: "tokenAddress";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      tokenID: {
        name: "tokenID";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "numeric"; ofType: null };
        };
      };
    };
  };
  Garden_bool_exp: {
    kind: "INPUT_OBJECT";
    name: "Garden_bool_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_and";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "Garden_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_not";
        type: { kind: "INPUT_OBJECT"; name: "Garden_bool_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_or";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "Garden_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "bannerImage";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "createdAt";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "db_write_timestamp";
        type: { kind: "INPUT_OBJECT"; name: "timestamp_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "description";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "gardeners";
        type: { kind: "INPUT_OBJECT"; name: "String_array_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "id";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "location";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "name";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "operators";
        type: { kind: "INPUT_OBJECT"; name: "String_array_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "tokenAddress";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "tokenID";
        type: { kind: "INPUT_OBJECT"; name: "numeric_comparison_exp"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  Garden_order_by: {
    kind: "INPUT_OBJECT";
    name: "Garden_order_by";
    isOneOf: false;
    inputFields: [
      {
        name: "bannerImage";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "createdAt";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "db_write_timestamp";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "description";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "gardeners";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      { name: "id"; type: { kind: "ENUM"; name: "order_by"; ofType: null }; defaultValue: null },
      {
        name: "location";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      { name: "name"; type: { kind: "ENUM"; name: "order_by"; ofType: null }; defaultValue: null },
      {
        name: "operators";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "tokenAddress";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "tokenID";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  Garden_select_column: {
    name: "Garden_select_column";
    enumValues:
      | "bannerImage"
      | "createdAt"
      | "db_write_timestamp"
      | "description"
      | "gardeners"
      | "id"
      | "location"
      | "name"
      | "operators"
      | "tokenAddress"
      | "tokenID";
  };
  Garden_stream_cursor_input: {
    kind: "INPUT_OBJECT";
    name: "Garden_stream_cursor_input";
    isOneOf: false;
    inputFields: [
      {
        name: "initial_value";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "INPUT_OBJECT"; name: "Garden_stream_cursor_value_input"; ofType: null };
        };
        defaultValue: null;
      },
      {
        name: "ordering";
        type: { kind: "ENUM"; name: "cursor_ordering"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  Garden_stream_cursor_value_input: {
    kind: "INPUT_OBJECT";
    name: "Garden_stream_cursor_value_input";
    isOneOf: false;
    inputFields: [
      {
        name: "bannerImage";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "createdAt";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "db_write_timestamp";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "description";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "gardeners";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      { name: "id"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      {
        name: "location";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      { name: "name"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      {
        name: "operators";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "tokenAddress";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "tokenID";
        type: { kind: "SCALAR"; name: "numeric"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  Int: unknown;
  Int_comparison_exp: {
    kind: "INPUT_OBJECT";
    name: "Int_comparison_exp";
    isOneOf: false;
    inputFields: [
      { name: "_eq"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      { name: "_gt"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      { name: "_gte"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      {
        name: "_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_is_null";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      { name: "_lt"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      { name: "_lte"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      { name: "_neq"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      {
        name: "_nin";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
          };
        };
        defaultValue: null;
      },
    ];
  };
  String: unknown;
  String_array_comparison_exp: {
    kind: "INPUT_OBJECT";
    name: "String_array_comparison_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_contained_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_contains";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_eq";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_gt";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_gte";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: {
              kind: "LIST";
              name: never;
              ofType: {
                kind: "NON_NULL";
                name: never;
                ofType: { kind: "SCALAR"; name: "String"; ofType: null };
              };
            };
          };
        };
        defaultValue: null;
      },
      {
        name: "_is_null";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_lt";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_lte";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_neq";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_nin";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: {
              kind: "LIST";
              name: never;
              ofType: {
                kind: "NON_NULL";
                name: never;
                ofType: { kind: "SCALAR"; name: "String"; ofType: null };
              };
            };
          };
        };
        defaultValue: null;
      },
    ];
  };
  String_comparison_exp: {
    kind: "INPUT_OBJECT";
    name: "String_comparison_exp";
    isOneOf: false;
    inputFields: [
      { name: "_eq"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      { name: "_gt"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      { name: "_gte"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      {
        name: "_ilike";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_iregex";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_is_null";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      { name: "_like"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      { name: "_lt"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      { name: "_lte"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      { name: "_neq"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      {
        name: "_nilike";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_nin";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_niregex";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_nlike";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_nregex";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_nsimilar";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_regex";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_similar";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  capital: unknown;
  capital_array_comparison_exp: {
    kind: "INPUT_OBJECT";
    name: "capital_array_comparison_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_contained_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_contains";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_eq";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_gt";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_gte";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: {
              kind: "LIST";
              name: never;
              ofType: {
                kind: "NON_NULL";
                name: never;
                ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
              };
            };
          };
        };
        defaultValue: null;
      },
      {
        name: "_is_null";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_lt";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_lte";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_neq";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_nin";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: {
              kind: "LIST";
              name: never;
              ofType: {
                kind: "NON_NULL";
                name: never;
                ofType: { kind: "SCALAR"; name: "capital"; ofType: null };
              };
            };
          };
        };
        defaultValue: null;
      },
    ];
  };
  chain_metadata: {
    kind: "OBJECT";
    name: "chain_metadata";
    fields: {
      block_height: {
        name: "block_height";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      chain_id: {
        name: "chain_id";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      end_block: { name: "end_block"; type: { kind: "SCALAR"; name: "Int"; ofType: null } };
      first_event_block_number: {
        name: "first_event_block_number";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
      };
      is_hyper_sync: {
        name: "is_hyper_sync";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        };
      };
      latest_fetched_block_number: {
        name: "latest_fetched_block_number";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      latest_processed_block: {
        name: "latest_processed_block";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
      };
      num_batches_fetched: {
        name: "num_batches_fetched";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      num_events_processed: {
        name: "num_events_processed";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
      };
      start_block: {
        name: "start_block";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      timestamp_caught_up_to_head_or_endblock: {
        name: "timestamp_caught_up_to_head_or_endblock";
        type: { kind: "SCALAR"; name: "timestamptz"; ofType: null };
      };
    };
  };
  chain_metadata_bool_exp: {
    kind: "INPUT_OBJECT";
    name: "chain_metadata_bool_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_and";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "chain_metadata_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_not";
        type: { kind: "INPUT_OBJECT"; name: "chain_metadata_bool_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_or";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "chain_metadata_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "block_height";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "chain_id";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "end_block";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "first_event_block_number";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "is_hyper_sync";
        type: { kind: "INPUT_OBJECT"; name: "Boolean_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "latest_fetched_block_number";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "latest_processed_block";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "num_batches_fetched";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "num_events_processed";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "start_block";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "timestamp_caught_up_to_head_or_endblock";
        type: { kind: "INPUT_OBJECT"; name: "timestamptz_comparison_exp"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  chain_metadata_order_by: {
    kind: "INPUT_OBJECT";
    name: "chain_metadata_order_by";
    isOneOf: false;
    inputFields: [
      {
        name: "block_height";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "chain_id";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "end_block";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "first_event_block_number";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "is_hyper_sync";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "latest_fetched_block_number";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "latest_processed_block";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "num_batches_fetched";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "num_events_processed";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "start_block";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "timestamp_caught_up_to_head_or_endblock";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  chain_metadata_select_column: {
    name: "chain_metadata_select_column";
    enumValues:
      | "block_height"
      | "chain_id"
      | "end_block"
      | "first_event_block_number"
      | "is_hyper_sync"
      | "latest_fetched_block_number"
      | "latest_processed_block"
      | "num_batches_fetched"
      | "num_events_processed"
      | "start_block"
      | "timestamp_caught_up_to_head_or_endblock";
  };
  chain_metadata_stream_cursor_input: {
    kind: "INPUT_OBJECT";
    name: "chain_metadata_stream_cursor_input";
    isOneOf: false;
    inputFields: [
      {
        name: "initial_value";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "INPUT_OBJECT";
            name: "chain_metadata_stream_cursor_value_input";
            ofType: null;
          };
        };
        defaultValue: null;
      },
      {
        name: "ordering";
        type: { kind: "ENUM"; name: "cursor_ordering"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  chain_metadata_stream_cursor_value_input: {
    kind: "INPUT_OBJECT";
    name: "chain_metadata_stream_cursor_value_input";
    isOneOf: false;
    inputFields: [
      {
        name: "block_height";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      { name: "chain_id"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      {
        name: "end_block";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "first_event_block_number";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "is_hyper_sync";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      {
        name: "latest_fetched_block_number";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "latest_processed_block";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "num_batches_fetched";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "num_events_processed";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "start_block";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "timestamp_caught_up_to_head_or_endblock";
        type: { kind: "SCALAR"; name: "timestamptz"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  contract_type: unknown;
  contract_type_comparison_exp: {
    kind: "INPUT_OBJECT";
    name: "contract_type_comparison_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_eq";
        type: { kind: "SCALAR"; name: "contract_type"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_gt";
        type: { kind: "SCALAR"; name: "contract_type"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_gte";
        type: { kind: "SCALAR"; name: "contract_type"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "contract_type"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_is_null";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_lt";
        type: { kind: "SCALAR"; name: "contract_type"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_lte";
        type: { kind: "SCALAR"; name: "contract_type"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_neq";
        type: { kind: "SCALAR"; name: "contract_type"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_nin";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "contract_type"; ofType: null };
          };
        };
        defaultValue: null;
      },
    ];
  };
  cursor_ordering: { name: "cursor_ordering"; enumValues: "ASC" | "DESC" };
  dynamic_contract_registry: {
    kind: "OBJECT";
    name: "dynamic_contract_registry";
    fields: {
      chain_id: {
        name: "chain_id";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      contract_address: {
        name: "contract_address";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      contract_type: {
        name: "contract_type";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "contract_type"; ofType: null };
        };
      };
      id: {
        name: "id";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      registering_event_block_number: {
        name: "registering_event_block_number";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      registering_event_block_timestamp: {
        name: "registering_event_block_timestamp";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      registering_event_contract_name: {
        name: "registering_event_contract_name";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      registering_event_log_index: {
        name: "registering_event_log_index";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      registering_event_name: {
        name: "registering_event_name";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      registering_event_src_address: {
        name: "registering_event_src_address";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
    };
  };
  dynamic_contract_registry_bool_exp: {
    kind: "INPUT_OBJECT";
    name: "dynamic_contract_registry_bool_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_and";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: {
              kind: "INPUT_OBJECT";
              name: "dynamic_contract_registry_bool_exp";
              ofType: null;
            };
          };
        };
        defaultValue: null;
      },
      {
        name: "_not";
        type: { kind: "INPUT_OBJECT"; name: "dynamic_contract_registry_bool_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_or";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: {
              kind: "INPUT_OBJECT";
              name: "dynamic_contract_registry_bool_exp";
              ofType: null;
            };
          };
        };
        defaultValue: null;
      },
      {
        name: "chain_id";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "contract_address";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "contract_type";
        type: { kind: "INPUT_OBJECT"; name: "contract_type_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "id";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_block_number";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_block_timestamp";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_contract_name";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_log_index";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_name";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_src_address";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  dynamic_contract_registry_order_by: {
    kind: "INPUT_OBJECT";
    name: "dynamic_contract_registry_order_by";
    isOneOf: false;
    inputFields: [
      {
        name: "chain_id";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "contract_address";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "contract_type";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      { name: "id"; type: { kind: "ENUM"; name: "order_by"; ofType: null }; defaultValue: null },
      {
        name: "registering_event_block_number";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_block_timestamp";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_contract_name";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_log_index";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_name";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_src_address";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  dynamic_contract_registry_select_column: {
    name: "dynamic_contract_registry_select_column";
    enumValues:
      | "chain_id"
      | "contract_address"
      | "contract_type"
      | "id"
      | "registering_event_block_number"
      | "registering_event_block_timestamp"
      | "registering_event_contract_name"
      | "registering_event_log_index"
      | "registering_event_name"
      | "registering_event_src_address";
  };
  dynamic_contract_registry_stream_cursor_input: {
    kind: "INPUT_OBJECT";
    name: "dynamic_contract_registry_stream_cursor_input";
    isOneOf: false;
    inputFields: [
      {
        name: "initial_value";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "INPUT_OBJECT";
            name: "dynamic_contract_registry_stream_cursor_value_input";
            ofType: null;
          };
        };
        defaultValue: null;
      },
      {
        name: "ordering";
        type: { kind: "ENUM"; name: "cursor_ordering"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  dynamic_contract_registry_stream_cursor_value_input: {
    kind: "INPUT_OBJECT";
    name: "dynamic_contract_registry_stream_cursor_value_input";
    isOneOf: false;
    inputFields: [
      { name: "chain_id"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      {
        name: "contract_address";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "contract_type";
        type: { kind: "SCALAR"; name: "contract_type"; ofType: null };
        defaultValue: null;
      },
      { name: "id"; type: { kind: "SCALAR"; name: "String"; ofType: null }; defaultValue: null },
      {
        name: "registering_event_block_number";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_block_timestamp";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_contract_name";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_log_index";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_name";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "registering_event_src_address";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  end_of_block_range_scanned_data: {
    kind: "OBJECT";
    name: "end_of_block_range_scanned_data";
    fields: {
      block_hash: {
        name: "block_hash";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      block_number: {
        name: "block_number";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      block_timestamp: {
        name: "block_timestamp";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      chain_id: {
        name: "chain_id";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
    };
  };
  end_of_block_range_scanned_data_bool_exp: {
    kind: "INPUT_OBJECT";
    name: "end_of_block_range_scanned_data_bool_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_and";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: {
              kind: "INPUT_OBJECT";
              name: "end_of_block_range_scanned_data_bool_exp";
              ofType: null;
            };
          };
        };
        defaultValue: null;
      },
      {
        name: "_not";
        type: {
          kind: "INPUT_OBJECT";
          name: "end_of_block_range_scanned_data_bool_exp";
          ofType: null;
        };
        defaultValue: null;
      },
      {
        name: "_or";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: {
              kind: "INPUT_OBJECT";
              name: "end_of_block_range_scanned_data_bool_exp";
              ofType: null;
            };
          };
        };
        defaultValue: null;
      },
      {
        name: "block_hash";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_number";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_timestamp";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "chain_id";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  end_of_block_range_scanned_data_order_by: {
    kind: "INPUT_OBJECT";
    name: "end_of_block_range_scanned_data_order_by";
    isOneOf: false;
    inputFields: [
      {
        name: "block_hash";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_number";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_timestamp";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "chain_id";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  end_of_block_range_scanned_data_select_column: {
    name: "end_of_block_range_scanned_data_select_column";
    enumValues: "block_hash" | "block_number" | "block_timestamp" | "chain_id";
  };
  end_of_block_range_scanned_data_stream_cursor_input: {
    kind: "INPUT_OBJECT";
    name: "end_of_block_range_scanned_data_stream_cursor_input";
    isOneOf: false;
    inputFields: [
      {
        name: "initial_value";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "INPUT_OBJECT";
            name: "end_of_block_range_scanned_data_stream_cursor_value_input";
            ofType: null;
          };
        };
        defaultValue: null;
      },
      {
        name: "ordering";
        type: { kind: "ENUM"; name: "cursor_ordering"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  end_of_block_range_scanned_data_stream_cursor_value_input: {
    kind: "INPUT_OBJECT";
    name: "end_of_block_range_scanned_data_stream_cursor_value_input";
    isOneOf: false;
    inputFields: [
      {
        name: "block_hash";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_number";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_timestamp";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      { name: "chain_id"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
    ];
  };
  event_sync_state: {
    kind: "OBJECT";
    name: "event_sync_state";
    fields: {
      block_number: {
        name: "block_number";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      block_timestamp: {
        name: "block_timestamp";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      chain_id: {
        name: "chain_id";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      is_pre_registering_dynamic_contracts: {
        name: "is_pre_registering_dynamic_contracts";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        };
      };
      log_index: {
        name: "log_index";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
    };
  };
  event_sync_state_bool_exp: {
    kind: "INPUT_OBJECT";
    name: "event_sync_state_bool_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_and";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "event_sync_state_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_not";
        type: { kind: "INPUT_OBJECT"; name: "event_sync_state_bool_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_or";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "event_sync_state_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "block_number";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_timestamp";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "chain_id";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "is_pre_registering_dynamic_contracts";
        type: { kind: "INPUT_OBJECT"; name: "Boolean_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "log_index";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  event_sync_state_order_by: {
    kind: "INPUT_OBJECT";
    name: "event_sync_state_order_by";
    isOneOf: false;
    inputFields: [
      {
        name: "block_number";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_timestamp";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "chain_id";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "is_pre_registering_dynamic_contracts";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "log_index";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  event_sync_state_select_column: {
    name: "event_sync_state_select_column";
    enumValues:
      | "block_number"
      | "block_timestamp"
      | "chain_id"
      | "is_pre_registering_dynamic_contracts"
      | "log_index";
  };
  event_sync_state_stream_cursor_input: {
    kind: "INPUT_OBJECT";
    name: "event_sync_state_stream_cursor_input";
    isOneOf: false;
    inputFields: [
      {
        name: "initial_value";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "INPUT_OBJECT";
            name: "event_sync_state_stream_cursor_value_input";
            ofType: null;
          };
        };
        defaultValue: null;
      },
      {
        name: "ordering";
        type: { kind: "ENUM"; name: "cursor_ordering"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  event_sync_state_stream_cursor_value_input: {
    kind: "INPUT_OBJECT";
    name: "event_sync_state_stream_cursor_value_input";
    isOneOf: false;
    inputFields: [
      {
        name: "block_number";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_timestamp";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      { name: "chain_id"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      {
        name: "is_pre_registering_dynamic_contracts";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      {
        name: "log_index";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  jsonb: unknown;
  jsonb_cast_exp: {
    kind: "INPUT_OBJECT";
    name: "jsonb_cast_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "String";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  jsonb_comparison_exp: {
    kind: "INPUT_OBJECT";
    name: "jsonb_comparison_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_cast";
        type: { kind: "INPUT_OBJECT"; name: "jsonb_cast_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_contained_in";
        type: { kind: "SCALAR"; name: "jsonb"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_contains";
        type: { kind: "SCALAR"; name: "jsonb"; ofType: null };
        defaultValue: null;
      },
      { name: "_eq"; type: { kind: "SCALAR"; name: "jsonb"; ofType: null }; defaultValue: null },
      { name: "_gt"; type: { kind: "SCALAR"; name: "jsonb"; ofType: null }; defaultValue: null },
      { name: "_gte"; type: { kind: "SCALAR"; name: "jsonb"; ofType: null }; defaultValue: null },
      {
        name: "_has_key";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_has_keys_all";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_has_keys_any";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "String"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "jsonb"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_is_null";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      { name: "_lt"; type: { kind: "SCALAR"; name: "jsonb"; ofType: null }; defaultValue: null },
      { name: "_lte"; type: { kind: "SCALAR"; name: "jsonb"; ofType: null }; defaultValue: null },
      { name: "_neq"; type: { kind: "SCALAR"; name: "jsonb"; ofType: null }; defaultValue: null },
      {
        name: "_nin";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "jsonb"; ofType: null };
          };
        };
        defaultValue: null;
      },
    ];
  };
  numeric: unknown;
  numeric_comparison_exp: {
    kind: "INPUT_OBJECT";
    name: "numeric_comparison_exp";
    isOneOf: false;
    inputFields: [
      { name: "_eq"; type: { kind: "SCALAR"; name: "numeric"; ofType: null }; defaultValue: null },
      { name: "_gt"; type: { kind: "SCALAR"; name: "numeric"; ofType: null }; defaultValue: null },
      { name: "_gte"; type: { kind: "SCALAR"; name: "numeric"; ofType: null }; defaultValue: null },
      {
        name: "_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "numeric"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_is_null";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      { name: "_lt"; type: { kind: "SCALAR"; name: "numeric"; ofType: null }; defaultValue: null },
      { name: "_lte"; type: { kind: "SCALAR"; name: "numeric"; ofType: null }; defaultValue: null },
      { name: "_neq"; type: { kind: "SCALAR"; name: "numeric"; ofType: null }; defaultValue: null },
      {
        name: "_nin";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "numeric"; ofType: null };
          };
        };
        defaultValue: null;
      },
    ];
  };
  order_by: {
    name: "order_by";
    enumValues:
      | "asc"
      | "asc_nulls_first"
      | "asc_nulls_last"
      | "desc"
      | "desc_nulls_first"
      | "desc_nulls_last";
  };
  persisted_state: {
    kind: "OBJECT";
    name: "persisted_state";
    fields: {
      abi_files_hash: {
        name: "abi_files_hash";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      config_hash: {
        name: "config_hash";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      envio_version: {
        name: "envio_version";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      handler_files_hash: {
        name: "handler_files_hash";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      id: {
        name: "id";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      schema_hash: {
        name: "schema_hash";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
    };
  };
  persisted_state_bool_exp: {
    kind: "INPUT_OBJECT";
    name: "persisted_state_bool_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_and";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "persisted_state_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_not";
        type: { kind: "INPUT_OBJECT"; name: "persisted_state_bool_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_or";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "persisted_state_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "abi_files_hash";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "config_hash";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "envio_version";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "handler_files_hash";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "id";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "schema_hash";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  persisted_state_order_by: {
    kind: "INPUT_OBJECT";
    name: "persisted_state_order_by";
    isOneOf: false;
    inputFields: [
      {
        name: "abi_files_hash";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "config_hash";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "envio_version";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "handler_files_hash";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      { name: "id"; type: { kind: "ENUM"; name: "order_by"; ofType: null }; defaultValue: null },
      {
        name: "schema_hash";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  persisted_state_select_column: {
    name: "persisted_state_select_column";
    enumValues:
      | "abi_files_hash"
      | "config_hash"
      | "envio_version"
      | "handler_files_hash"
      | "id"
      | "schema_hash";
  };
  persisted_state_stream_cursor_input: {
    kind: "INPUT_OBJECT";
    name: "persisted_state_stream_cursor_input";
    isOneOf: false;
    inputFields: [
      {
        name: "initial_value";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "INPUT_OBJECT";
            name: "persisted_state_stream_cursor_value_input";
            ofType: null;
          };
        };
        defaultValue: null;
      },
      {
        name: "ordering";
        type: { kind: "ENUM"; name: "cursor_ordering"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  persisted_state_stream_cursor_value_input: {
    kind: "INPUT_OBJECT";
    name: "persisted_state_stream_cursor_value_input";
    isOneOf: false;
    inputFields: [
      {
        name: "abi_files_hash";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "config_hash";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "envio_version";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "handler_files_hash";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      { name: "id"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      {
        name: "schema_hash";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  query_root: {
    kind: "OBJECT";
    name: "query_root";
    fields: {
      Action: {
        name: "Action";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "Action"; ofType: null };
            };
          };
        };
      };
      Action_by_pk: {
        name: "Action_by_pk";
        type: { kind: "OBJECT"; name: "Action"; ofType: null };
      };
      Garden: {
        name: "Garden";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "Garden"; ofType: null };
            };
          };
        };
      };
      Garden_by_pk: {
        name: "Garden_by_pk";
        type: { kind: "OBJECT"; name: "Garden"; ofType: null };
      };
      chain_metadata: {
        name: "chain_metadata";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "chain_metadata"; ofType: null };
            };
          };
        };
      };
      chain_metadata_by_pk: {
        name: "chain_metadata_by_pk";
        type: { kind: "OBJECT"; name: "chain_metadata"; ofType: null };
      };
      dynamic_contract_registry: {
        name: "dynamic_contract_registry";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "dynamic_contract_registry"; ofType: null };
            };
          };
        };
      };
      dynamic_contract_registry_by_pk: {
        name: "dynamic_contract_registry_by_pk";
        type: { kind: "OBJECT"; name: "dynamic_contract_registry"; ofType: null };
      };
      end_of_block_range_scanned_data: {
        name: "end_of_block_range_scanned_data";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "end_of_block_range_scanned_data"; ofType: null };
            };
          };
        };
      };
      end_of_block_range_scanned_data_by_pk: {
        name: "end_of_block_range_scanned_data_by_pk";
        type: { kind: "OBJECT"; name: "end_of_block_range_scanned_data"; ofType: null };
      };
      event_sync_state: {
        name: "event_sync_state";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "event_sync_state"; ofType: null };
            };
          };
        };
      };
      event_sync_state_by_pk: {
        name: "event_sync_state_by_pk";
        type: { kind: "OBJECT"; name: "event_sync_state"; ofType: null };
      };
      persisted_state: {
        name: "persisted_state";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "persisted_state"; ofType: null };
            };
          };
        };
      };
      persisted_state_by_pk: {
        name: "persisted_state_by_pk";
        type: { kind: "OBJECT"; name: "persisted_state"; ofType: null };
      };
      raw_events: {
        name: "raw_events";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "raw_events"; ofType: null };
            };
          };
        };
      };
      raw_events_by_pk: {
        name: "raw_events_by_pk";
        type: { kind: "OBJECT"; name: "raw_events"; ofType: null };
      };
    };
  };
  raw_events: {
    kind: "OBJECT";
    name: "raw_events";
    fields: {
      block_fields: {
        name: "block_fields";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "jsonb"; ofType: null };
        };
      };
      block_hash: {
        name: "block_hash";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      block_number: {
        name: "block_number";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      block_timestamp: {
        name: "block_timestamp";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      chain_id: {
        name: "chain_id";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      contract_name: {
        name: "contract_name";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      db_write_timestamp: {
        name: "db_write_timestamp";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
      };
      event_id: {
        name: "event_id";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "numeric"; ofType: null };
        };
      };
      event_name: {
        name: "event_name";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      log_index: {
        name: "log_index";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      params: {
        name: "params";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "jsonb"; ofType: null };
        };
      };
      serial: {
        name: "serial";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "Int"; ofType: null };
        };
      };
      src_address: {
        name: "src_address";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "String"; ofType: null };
        };
      };
      transaction_fields: {
        name: "transaction_fields";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: { kind: "SCALAR"; name: "jsonb"; ofType: null };
        };
      };
    };
  };
  raw_events_bool_exp: {
    kind: "INPUT_OBJECT";
    name: "raw_events_bool_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_and";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "raw_events_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_not";
        type: { kind: "INPUT_OBJECT"; name: "raw_events_bool_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_or";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "INPUT_OBJECT"; name: "raw_events_bool_exp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "block_fields";
        type: { kind: "INPUT_OBJECT"; name: "jsonb_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_hash";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_number";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_timestamp";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "chain_id";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "contract_name";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "db_write_timestamp";
        type: { kind: "INPUT_OBJECT"; name: "timestamp_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "event_id";
        type: { kind: "INPUT_OBJECT"; name: "numeric_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "event_name";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "log_index";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "params";
        type: { kind: "INPUT_OBJECT"; name: "jsonb_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "serial";
        type: { kind: "INPUT_OBJECT"; name: "Int_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "src_address";
        type: { kind: "INPUT_OBJECT"; name: "String_comparison_exp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "transaction_fields";
        type: { kind: "INPUT_OBJECT"; name: "jsonb_comparison_exp"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  raw_events_order_by: {
    kind: "INPUT_OBJECT";
    name: "raw_events_order_by";
    isOneOf: false;
    inputFields: [
      {
        name: "block_fields";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_hash";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_number";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_timestamp";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "chain_id";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "contract_name";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "db_write_timestamp";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "event_id";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "event_name";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "log_index";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "params";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "serial";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "src_address";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
      {
        name: "transaction_fields";
        type: { kind: "ENUM"; name: "order_by"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  raw_events_select_column: {
    name: "raw_events_select_column";
    enumValues:
      | "block_fields"
      | "block_hash"
      | "block_number"
      | "block_timestamp"
      | "chain_id"
      | "contract_name"
      | "db_write_timestamp"
      | "event_id"
      | "event_name"
      | "log_index"
      | "params"
      | "serial"
      | "src_address"
      | "transaction_fields";
  };
  raw_events_stream_cursor_input: {
    kind: "INPUT_OBJECT";
    name: "raw_events_stream_cursor_input";
    isOneOf: false;
    inputFields: [
      {
        name: "initial_value";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "INPUT_OBJECT";
            name: "raw_events_stream_cursor_value_input";
            ofType: null;
          };
        };
        defaultValue: null;
      },
      {
        name: "ordering";
        type: { kind: "ENUM"; name: "cursor_ordering"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  raw_events_stream_cursor_value_input: {
    kind: "INPUT_OBJECT";
    name: "raw_events_stream_cursor_value_input";
    isOneOf: false;
    inputFields: [
      {
        name: "block_fields";
        type: { kind: "SCALAR"; name: "jsonb"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_hash";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_number";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      {
        name: "block_timestamp";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      { name: "chain_id"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      {
        name: "contract_name";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "db_write_timestamp";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "event_id";
        type: { kind: "SCALAR"; name: "numeric"; ofType: null };
        defaultValue: null;
      },
      {
        name: "event_name";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "log_index";
        type: { kind: "SCALAR"; name: "Int"; ofType: null };
        defaultValue: null;
      },
      { name: "params"; type: { kind: "SCALAR"; name: "jsonb"; ofType: null }; defaultValue: null },
      { name: "serial"; type: { kind: "SCALAR"; name: "Int"; ofType: null }; defaultValue: null },
      {
        name: "src_address";
        type: { kind: "SCALAR"; name: "String"; ofType: null };
        defaultValue: null;
      },
      {
        name: "transaction_fields";
        type: { kind: "SCALAR"; name: "jsonb"; ofType: null };
        defaultValue: null;
      },
    ];
  };
  subscription_root: {
    kind: "OBJECT";
    name: "subscription_root";
    fields: {
      Action: {
        name: "Action";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "Action"; ofType: null };
            };
          };
        };
      };
      Action_by_pk: {
        name: "Action_by_pk";
        type: { kind: "OBJECT"; name: "Action"; ofType: null };
      };
      Action_stream: {
        name: "Action_stream";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "Action"; ofType: null };
            };
          };
        };
      };
      Garden: {
        name: "Garden";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "Garden"; ofType: null };
            };
          };
        };
      };
      Garden_by_pk: {
        name: "Garden_by_pk";
        type: { kind: "OBJECT"; name: "Garden"; ofType: null };
      };
      Garden_stream: {
        name: "Garden_stream";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "Garden"; ofType: null };
            };
          };
        };
      };
      chain_metadata: {
        name: "chain_metadata";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "chain_metadata"; ofType: null };
            };
          };
        };
      };
      chain_metadata_by_pk: {
        name: "chain_metadata_by_pk";
        type: { kind: "OBJECT"; name: "chain_metadata"; ofType: null };
      };
      chain_metadata_stream: {
        name: "chain_metadata_stream";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "chain_metadata"; ofType: null };
            };
          };
        };
      };
      dynamic_contract_registry: {
        name: "dynamic_contract_registry";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "dynamic_contract_registry"; ofType: null };
            };
          };
        };
      };
      dynamic_contract_registry_by_pk: {
        name: "dynamic_contract_registry_by_pk";
        type: { kind: "OBJECT"; name: "dynamic_contract_registry"; ofType: null };
      };
      dynamic_contract_registry_stream: {
        name: "dynamic_contract_registry_stream";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "dynamic_contract_registry"; ofType: null };
            };
          };
        };
      };
      end_of_block_range_scanned_data: {
        name: "end_of_block_range_scanned_data";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "end_of_block_range_scanned_data"; ofType: null };
            };
          };
        };
      };
      end_of_block_range_scanned_data_by_pk: {
        name: "end_of_block_range_scanned_data_by_pk";
        type: { kind: "OBJECT"; name: "end_of_block_range_scanned_data"; ofType: null };
      };
      end_of_block_range_scanned_data_stream: {
        name: "end_of_block_range_scanned_data_stream";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "end_of_block_range_scanned_data"; ofType: null };
            };
          };
        };
      };
      event_sync_state: {
        name: "event_sync_state";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "event_sync_state"; ofType: null };
            };
          };
        };
      };
      event_sync_state_by_pk: {
        name: "event_sync_state_by_pk";
        type: { kind: "OBJECT"; name: "event_sync_state"; ofType: null };
      };
      event_sync_state_stream: {
        name: "event_sync_state_stream";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "event_sync_state"; ofType: null };
            };
          };
        };
      };
      persisted_state: {
        name: "persisted_state";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "persisted_state"; ofType: null };
            };
          };
        };
      };
      persisted_state_by_pk: {
        name: "persisted_state_by_pk";
        type: { kind: "OBJECT"; name: "persisted_state"; ofType: null };
      };
      persisted_state_stream: {
        name: "persisted_state_stream";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "persisted_state"; ofType: null };
            };
          };
        };
      };
      raw_events: {
        name: "raw_events";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "raw_events"; ofType: null };
            };
          };
        };
      };
      raw_events_by_pk: {
        name: "raw_events_by_pk";
        type: { kind: "OBJECT"; name: "raw_events"; ofType: null };
      };
      raw_events_stream: {
        name: "raw_events_stream";
        type: {
          kind: "NON_NULL";
          name: never;
          ofType: {
            kind: "LIST";
            name: never;
            ofType: {
              kind: "NON_NULL";
              name: never;
              ofType: { kind: "OBJECT"; name: "raw_events"; ofType: null };
            };
          };
        };
      };
    };
  };
  timestamp: unknown;
  timestamp_comparison_exp: {
    kind: "INPUT_OBJECT";
    name: "timestamp_comparison_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_eq";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_gt";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_gte";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "timestamp"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_is_null";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_lt";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_lte";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_neq";
        type: { kind: "SCALAR"; name: "timestamp"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_nin";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "timestamp"; ofType: null };
          };
        };
        defaultValue: null;
      },
    ];
  };
  timestamptz: unknown;
  timestamptz_comparison_exp: {
    kind: "INPUT_OBJECT";
    name: "timestamptz_comparison_exp";
    isOneOf: false;
    inputFields: [
      {
        name: "_eq";
        type: { kind: "SCALAR"; name: "timestamptz"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_gt";
        type: { kind: "SCALAR"; name: "timestamptz"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_gte";
        type: { kind: "SCALAR"; name: "timestamptz"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_in";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "timestamptz"; ofType: null };
          };
        };
        defaultValue: null;
      },
      {
        name: "_is_null";
        type: { kind: "SCALAR"; name: "Boolean"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_lt";
        type: { kind: "SCALAR"; name: "timestamptz"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_lte";
        type: { kind: "SCALAR"; name: "timestamptz"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_neq";
        type: { kind: "SCALAR"; name: "timestamptz"; ofType: null };
        defaultValue: null;
      },
      {
        name: "_nin";
        type: {
          kind: "LIST";
          name: never;
          ofType: {
            kind: "NON_NULL";
            name: never;
            ofType: { kind: "SCALAR"; name: "timestamptz"; ofType: null };
          };
        };
        defaultValue: null;
      },
    ];
  };
};

/** An IntrospectionQuery representation of your schema.
 *
 * @remarks
 * This is an introspection of your schema saved as a file by GraphQLSP.
 * It will automatically be used by `gql.tada` to infer the types of your GraphQL documents.
 * If you need to reuse this data or update your `scalars`, update `tadaOutputLocation` to
 * instead save to a .ts instead of a .d.ts file.
 */
export type introspection = {
  name: "Green Goods";
  query: "query_root";
  mutation: never;
  subscription: "subscription_root";
  types: introspection_types;
};

import * as gqlTada from "gql.tada";
