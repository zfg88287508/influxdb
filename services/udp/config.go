package udp

import (
	"time"

	"github.com/influxdb/influxdb/toml"
)

const (
	// DefaultBindAddress is the default binding interface if none is specified.
	DefaultBindAddress = ":8089"

	// DefaultDatabase is the default database for UDP traffic.
	DefaultDatabase = "udp"

	// DefaultRetentionPolicy is the default retention policy used for writes.
	DefaultRetentionPolicy = ""

	// DefaultBatchSize is the default UDP batch size.
	DefaultBatchSize = 5000

	// DefaultBatchPending is the default number of pending UDP batches.
	DefaultBatchPending = 10

	// DefaultBatchTimeout is the default UDP batch timeout.
	DefaultBatchTimeout = time.Second

	// DefaultReadBuffer is the default buffer size for the UDP listener.
	// Increasing this increases the number of packets that the listener can handle,
	// but also increases the memory usage.
	DefaultReadBuffer = 8 * 1024 * 1024
)

type Config struct {
	Enabled     bool   `toml:"enabled"`
	BindAddress string `toml:"bind-address"`

	Database        string        `toml:"database"`
	RetentionPolicy string        `toml:"retention-policy"`
	BatchSize       int           `toml:"batch-size"`
	BatchPending    int           `toml:"batch-pending"`
	ReadBuffer      int           `toml:"read-buffer"`
	BatchTimeout    toml.Duration `toml:"batch-timeout"`
}

func NewConfig() Config {
	return Config{
		BindAddress:     DefaultBindAddress,
		Database:        DefaultDatabase,
		RetentionPolicy: DefaultRetentionPolicy,
		BatchSize:       DefaultBatchSize,
		BatchPending:    DefaultBatchPending,
		BatchTimeout:    toml.Duration(DefaultBatchTimeout),
	}
}

// WithDefaults takes the given config and returns a new config with any required
// default values set.
func (c *Config) WithDefaults() *Config {
	d := *c
	if d.Database == "" {
		d.Database = DefaultDatabase
	}
	if d.BatchSize == 0 {
		d.BatchSize = DefaultBatchSize
	}
	if d.BatchPending == 0 {
		d.BatchPending = DefaultBatchPending
	}
	if d.BatchTimeout == 0 {
		d.BatchTimeout = toml.Duration(DefaultBatchTimeout)
	}
	if d.ReadBuffer == 0 {
		d.ReadBuffer = DefaultReadBuffer
	}
	return &d
}
