// Package migrations embeds the SQL files applied at startup.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
