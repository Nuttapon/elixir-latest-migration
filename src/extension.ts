import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "ElixirLatestMigration" is now active.');

	let disposable = vscode.commands.registerCommand(
		'elixir-latest-migration.elixirLatestMigration',
		async () => {
			const workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showWarningMessage('No workspace folder found.');
				return;
			}

			try {
				const workspacePath = workspaceFolders[0].uri.fsPath;
				const migrationsPath = await findMigrationsPath(workspacePath);

				if (migrationsPath) {
					const latestMigration = await findLatestMigration(migrationsPath);
					if (latestMigration) {
						const migrationFilePath = path.join(migrationsPath, latestMigration);
						const doc = await vscode.workspace.openTextDocument(migrationFilePath);
						vscode.window.showTextDocument(doc);
					} else {
						vscode.window.showInformationMessage('No migration files found.');
					}
				}
			} catch (error) {
				if (error instanceof Error) {
					throw new Error(`Error finding migrations path: ${error.message}`);
				} else {
					throw new Error('An unknown error occurred while finding migrations path');
				}
			}
		}
	);

	context.subscriptions.push(disposable);
}

export function deactivate() { }

async function findMigrationsPath(workspacePath: string): Promise<string | null> {
	const umbrellaAppsPath = path.join(workspacePath, 'apps');

	try {
		if (await isDirectory(umbrellaAppsPath)) {
			const appFolders = await fs.readdir(umbrellaAppsPath);
			for (const appFolder of appFolders) {
				const appFolderPath = path.join(umbrellaAppsPath, appFolder);
				if (await isDirectory(appFolderPath)) {
					const migrationsPath = path.join(appFolderPath, 'priv', 'repo', 'migrations');
					if (await isDirectory(migrationsPath)) {
						return migrationsPath;
					}
				}
			}
		}

		// Fallback to non-umbrella project structure
		const migrationsPath = path.join(workspacePath, 'priv', 'repo', 'migrations');
		return (await isDirectory(migrationsPath)) ? migrationsPath : null;
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Error finding migrations path: ${error.message}`);
		} else {
			throw new Error('An unknown error occurred while finding migrations path');
		}
	}
}

async function findLatestMigration(migrationsPath: string): Promise<string | null> {
	try {
		const files = await fs.readdir(migrationsPath);
		const migrationFiles = files.filter(file => /\.(exs|ex)$/.test(file));

		if (migrationFiles.length === 0) { return null; }

		const sortedMigrations = await sortFilesByModifiedTime(migrationsPath, migrationFiles);
		return sortedMigrations[0];
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Error finding latest migration: ${error.message}`);
		} else {
			throw new Error('An unknown error occurred while finding the latest migration');
		}
	}
}

async function sortFilesByModifiedTime(directory: string, files: string[]): Promise<string[]> {
	const fileStats = await Promise.all(
		files.map(async (file) => ({
			file,
			mtime: (await fs.stat(path.join(directory, file))).mtime,
		}))
	);

	return fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime()).map(stats => stats.file);
}

async function isDirectory(filePath: string): Promise<boolean> {
	try {
		return (await fs.lstat(filePath)).isDirectory();
	} catch (error) {
		return false;
	}
}
