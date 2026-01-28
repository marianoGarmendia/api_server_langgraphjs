export function $(strings, ...rest) {
  const command = strings.reduce((acc, item, idx) => {
    acc += item;
    const arg = rest[idx];
    if (Array.isArray(arg)) {
      acc += arg.join(" ");
    } else if (typeof arg === "string" || typeof arg === "number") {
      acc += arg;
    }
    return acc;
  }, "$ ");

  process.stderr.write(command + "\n");
  // Cross-platform (Node): run via system shell (cmd.exe on Windows, sh on *nix).
  // We intentionally keep the same `$` template API used across scripts/*.mjs.
  const cmd = command.replace(/^\$\s*/, "");
  return new Promise((resolve, reject) => {
    // Lazy import to keep module lightweight
    import("node:child_process")
      .then(({ spawn }) => {
        const child = spawn(cmd, {
          shell: true,
          stdio: "inherit",
          windowsHide: true,
        });
        child.on("error", reject);
        child.on("exit", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Command failed (${code}): ${cmd}`));
        });
      })
      .catch(reject);
  });
}
