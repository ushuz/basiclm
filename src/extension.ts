import * as vscode from "vscode"
import { LMAPIServer } from "./server/LMAPIServer"
import { Logger } from "./utils/Logger"
import { DEFAULT_CONFIG } from "./constants"

let server: LMAPIServer
let statusBarItem: vscode.StatusBarItem

export function activate(context: vscode.ExtensionContext) {
  Logger.info("BasicLM extension activating")

  // initialize server
  server = new LMAPIServer()

  // create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  )
  statusBarItem.command = "basiclm.status"
  context.subscriptions.push(statusBarItem)

  // register commands
  registerCommands(context)

  // auto-start if configured
  const config = vscode.workspace.getConfiguration("basiclm")
  if (config.get<boolean>("autoStart", DEFAULT_CONFIG.autoStart)) {
    checkLanguageModelAccess().then(hasAccess => {
      if (hasAccess) {
        vscode.commands.executeCommand("basiclm.start")
      } else {
        Logger.warn("auto-start skipped: Language Model access not available")
      }
    })
  }

  updateStatusBar()
  Logger.info("BasicLM extension activated")
}

export function deactivate() {
  Logger.info("BasicLM extension deactivating")

  if (server) {
    server.dispose()
  }

  if (statusBarItem) {
    statusBarItem.dispose()
  }
}

function registerCommands(context: vscode.ExtensionContext) {
  // start server command
  const startCommand = vscode.commands.registerCommand("basiclm.start", async () => {
    try {
      if (server.isRunning()) {
        vscode.window.showWarningMessage("BasicLM is already running")
        return
      }

      await server.start()
      updateStatusBar()
      vscode.window.showInformationMessage("BasicLM started successfully")
    } catch (error) {
      const errorMessage = `Failed to start BasicLM: ${(error as Error).message}`
      Logger.error(errorMessage, error as Error)
      vscode.window.showErrorMessage(errorMessage)
    }
  })

  // stop server command
  const stopCommand = vscode.commands.registerCommand("basiclm.stop", async () => {
    try {
      if (!server.isRunning()) {
        vscode.window.showWarningMessage("BasicLM is not running")
        return
      }

      await server.stop()
      updateStatusBar()
      vscode.window.showInformationMessage("BasicLM stopped")
    } catch (error) {
      const errorMessage = `Failed to stop BasicLM: ${(error as Error).message}`
      Logger.error(errorMessage, error as Error)
      vscode.window.showErrorMessage(errorMessage)
    }
  })

  // restart server command
  const restartCommand = vscode.commands.registerCommand("basiclm.restart", async () => {
    try {
      await server.restart()
      updateStatusBar()
      vscode.window.showInformationMessage("BasicLM restarted")
    } catch (error) {
      const errorMessage = `Failed to restart BasicLM: ${(error as Error).message}`
      Logger.error(errorMessage, error as Error)
      vscode.window.showErrorMessage(errorMessage)
    }
  })

  // status command
  const statusCommand = vscode.commands.registerCommand("basiclm.status", async () => {
    showServerStatus()
  })

  context.subscriptions.push(
    startCommand,
    stopCommand,
    restartCommand,
    statusCommand
  )
}

function updateStatusBar() {
  const state = server.getState()

  if (state.isRunning) {
    statusBarItem.text = `$(server) BasicLM :${state.port}`
    statusBarItem.tooltip = `BasicLM is running on http://${state.host}:${state.port}\nClick for details`
    statusBarItem.backgroundColor = undefined
  } else {
    statusBarItem.text = "$(server) BasicLM (stopped)"
    statusBarItem.tooltip = "BasicLM is stopped\nClick to start"
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
  }

  statusBarItem.show()
}

async function showServerStatus() {
  const state = server.getState()

  if (state.isRunning) {
    const uptime = state.startTime ? Math.floor((Date.now() - state.startTime.getTime()) / 1000) : 0
    const uptimeStr = formatUptime(uptime)

    const items = [
      {
        label: "Stop Server",
        description: "Stop the BasicLM",
        action: "stop",
      },
      {
        label: "Restart Server",
        description: "Restart the BasicLM",
        action: "restart",
      },
      {
        label: "Copy OpenAI URL",
        description: `http://${state.host}:${state.port}/v1/chat/completions`,
        action: "copy-openai-url",
      },
      {
        label: "Copy Anthropic URL",
        description: `http://${state.host}:${state.port}/v1/messages`,
        action: "copy-anthropic-url",
      },
    ]

    const selected = await vscode.window.showQuickPick(items, {
      title: "BasicLM Status",
      placeHolder: `Running on http://${state.host}:${state.port} | Uptime: ${uptimeStr} | Requests: ${state.requestCount}`,
    })

    if (selected) {
      await handleStatusAction(selected.action)
    }
  } else {
    const config = server.getConfig()
    const items = [
      {
        label: "Start Server",
        description: `Start on http://${config.host}:${config.port}`,
        action: "start",
      },
      {
        label: "Configure",
        description: "Open extension settings",
        action: "configure",
      },
    ]

    const selected = await vscode.window.showQuickPick(items, {
      title: "BasicLM Status",
      placeHolder: "Stopped",
    })

    if (selected) {
      await handleStatusAction(selected.action)
    }
  }
}

async function handleStatusAction(action: string) {
  switch (action) {
    case "start":
      await vscode.commands.executeCommand("basiclm.start")
      break
    case "stop":
      await vscode.commands.executeCommand("basiclm.stop")
      break
    case "restart":
      await vscode.commands.executeCommand("basiclm.restart")
      break
    case "configure":
      await vscode.commands.executeCommand("workbench.action.openSettings", "basiclm")
      break
    case "copy-openai-url":
      const state = server.getState()
      const openaiUrl = `http://${state.host}:${state.port}/v1/chat/completions`
      await vscode.env.clipboard.writeText(openaiUrl)
      vscode.window.showInformationMessage("Copied OpenAI URL to clipboard")
      break
    case "copy-anthropic-url":
      const stateAnthropic = server.getState()
      const anthropicUrl = `http://${stateAnthropic.host}:${stateAnthropic.port}/v1/messages`
      await vscode.env.clipboard.writeText(anthropicUrl)
      vscode.window.showInformationMessage("Copied Anthropic URL to clipboard")
      break
  }
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  } else {
    return `${remainingSeconds}s`
  }
}

async function checkLanguageModelAccess(): Promise<boolean> {
  try {
    const models = await vscode.lm.selectChatModels()
    return models.length > 0
  } catch (error) {
    Logger.warn("language model access check failed", { error: (error as Error).message })
    return false
  }
}
