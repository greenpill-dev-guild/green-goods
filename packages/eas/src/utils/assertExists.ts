export const assertExists = (variable?: string, name?: string) => {
    if (!variable) {
        throw new Error(`Environment variable ${name} is not set.`);
    }

    return variable;
};