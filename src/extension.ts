import * as vscode from "vscode";
import { LMAPIServer } from "./server/LMAPIServer";
import { Logger } from "./utils/Logger";

let server: LMAPIServer;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    Logger.info("Basic LM API extension activating");

    // Initialize server
    server = new LMAPIServer();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = "basiclmapi.status";
    context.subscriptions.push(statusBarItem);

    // Register commands
    registerCommands(context);

    // Auto-start if configured
    const config = vscode.workspace.getConfiguration("basiclmapi");
    if (config.get<boolean>("autoStart", false)) {
        checkLanguageModelAccess().then(hasAccess => {
            if (hasAccess) {
                vscode.commands.executeCommand("basiclmapi.start");
            } else {
                Logger.warn("Auto-start skipped: Language Model access not available");
            }
        });
    }

    updateStatusBar();
    Logger.info("Basic LM API extension activated");
}

export function deactivate() {
    Logger.info("Basic LM API extension deactivating");

    if (server) {
        server.dispose();
    }

    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

function registerCommands(context: vscode.ExtensionContext) {
    // Start server command
    const startCommand = vscode.commands.registerCommand("basiclmapi.start", async () => {
        try {
            if (server.isRunning()) {
                vscode.window.showWarningMessage("Server is already running");
                return;
            }

            await server.start();
            updateStatusBar();
            vscode.window.showInformationMessage("LM API Server started successfully");
        } catch (error) {
            const errorMessage = `Failed to start server: ${(error as Error).message}`;
            Logger.error(errorMessage, error as Error);
            vscode.window.showErrorMessage(errorMessage);
        }
    });

    // Stop server command
    const stopCommand = vscode.commands.registerCommand("basiclmapi.stop", async () => {
        try {
            if (!server.isRunning()) {
                vscode.window.showWarningMessage("Server is not running");
                return;
            }

            await server.stop();
            updateStatusBar();
            vscode.window.showInformationMessage("LM API Server stopped");
        } catch (error) {
            const errorMessage = `Failed to stop server: ${(error as Error).message}`;
            Logger.error(errorMessage, error as Error);
            vscode.window.showErrorMessage(errorMessage);
        }
    });

    // Restart server command
    const restartCommand = vscode.commands.registerCommand("basiclmapi.restart", async () => {
        try {
            await server.restart();
            updateStatusBar();
            vscode.window.showInformationMessage("LM API Server restarted");
        } catch (error) {
            const errorMessage = `Failed to restart server: ${(error as Error).message}`;
            Logger.error(errorMessage, error as Error);
            vscode.window.showErrorMessage(errorMessage);
        }
    });

    // Status command
    const statusCommand = vscode.commands.registerCommand("basiclmapi.status", async () => {
        showServerStatus();
    });

    context.subscriptions.push(
        startCommand,
        stopCommand,
        restartCommand,
        statusCommand
    );
}

function updateStatusBar() {
    const state = server.getState();

    if (state.isRunning) {
        statusBarItem.text = `$(server) LM API :${state.port}`;
        statusBarItem.tooltip = `LM API Server running on http://${state.host}:${state.port}\nClick for details`;
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `$(server) LM API (stopped)`;
        statusBarItem.tooltip = "LM API Server is stopped\nClick to start";
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    }

    statusBarItem.show();
}

async function showServerStatus() {
    const state = server.getState();

    if (state.isRunning) {
        const uptime = state.startTime ? Math.floor((Date.now() - state.startTime.getTime()) / 1000) : 0;
        const uptimeStr = formatUptime(uptime);

        const items = [
            {
                label: "Stop Server",
                description: "Stop the LM API server",
                action: "stop"
            },
            {
                label: "Restart Server",
                description: "Restart the LM API server",
                action: "restart"
            },
            {
                label: "Copy OpenAI URL",
                description: `http://${state.host}:${state.port}/v1/chat/completions`,
                action: "copy-openai-url"
            },
            {
                label: "Copy Anthropic URL",
                description: `http://${state.host}:${state.port}/v1/messages`,
                action: "copy-anthropic-url"
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            title: "LM API Server Status",
            placeHolder: `Running on http://${state.host}:${state.port} | Uptime: ${uptimeStr} | Requests: ${state.requestCount}`
        });

        if (selected) {
            await handleStatusAction(selected.action);
        }
    } else {
        const config = server.getConfig();
        const items = [
            {
                label: "Start Server",
                description: `Start on http://${config.host}:${config.port}`,
                action: "start"
            },
            {
                label: "Configure",
                description: "Open extension settings",
                action: "configure"
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            title: "LM API Server Status",
            placeHolder: "Server is stopped"
        });

        if (selected) {
            await handleStatusAction(selected.action);
        }
    }
}

async function handleStatusAction(action: string) {
    switch (action) {
        case "start":
            await vscode.commands.executeCommand("basiclmapi.start");
            break;
        case "stop":
            await vscode.commands.executeCommand("basiclmapi.stop");
            break;
        case "restart":
            await vscode.commands.executeCommand("basiclmapi.restart");
            break;
        case "configure":
            await vscode.commands.executeCommand("workbench.action.openSettings", "basiclmapi");
            break;
        case "copy-openai-url":
            const state = server.getState();
            const openaiUrl = `http://${state.host}:${state.port}/v1/chat/completions`;
            await vscode.env.clipboard.writeText(openaiUrl);
            vscode.window.showInformationMessage(`Copied OpenAI URL to clipboard`);
            break;
        case "copy-anthropic-url":
            const stateAnthropic = server.getState();
            const anthropicUrl = `http://${stateAnthropic.host}:${stateAnthropic.port}/v1/messages`;
            await vscode.env.clipboard.writeText(anthropicUrl);
            vscode.window.showInformationMessage(`Copied Anthropic URL to clipboard`);
            break;
    }
}

function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${remainingSeconds}s`;
    }
}

async function checkLanguageModelAccess(): Promise<boolean> {
    try {
        const models = await vscode.lm.selectChatModels();
        return models.length > 0;
    } catch (error) {
        Logger.warn("Language model access check failed", { error: (error as Error).message });
        return false;
    }
}