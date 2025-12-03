import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotClient } from '../../core/client';
import * as os from 'os';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Display comprehensive bot status and system information');

// Custom Discord tick emoji
const TICK = '<:tcet_tick:1437995479567962184>';

async function getDatabaseStats(client: BotClient): Promise<{
  connected: boolean;
  totalRecords: number;
  panels: number;
  tickets: number;
  openTickets: number;
  closedTickets: number;
  storage: string;
  totalStorage: string;
  host: string;
  port: string;
  dbName: string;
  dbVersion: string;
  maxConnections: number;
  activeConnections: number;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();


  try {
    if (!client.db.isConnectionActive()) {

      return {
        connected: false,
        totalRecords: 0,
        panels: 0,
        tickets: 0,
        openTickets: 0,
        closedTickets: 0,
        storage: 'N/A',
        totalStorage: 'N/A',
        host: 'N/A',
        port: 'N/A',
        dbName: 'N/A',
        dbVersion: 'N/A',
        maxConnections: 0,
        activeConnections: 0,
        responseTime: 0,
        error: 'Not connected'
      };
    }

    const pool = client.db.getPool();

    // OPTIMIZED: Single query to get all counts at once
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE type IS NOT NULL) as total_records,
        COUNT(*) FILTER (WHERE type = 'panel') as panels,
        COUNT(*) FILTER (WHERE type = 'ticket') as tickets,
        COUNT(*) FILTER (WHERE type = 'ticket' AND data->>'state' = 'open') as open_tickets,
        COUNT(*) FILTER (WHERE type = 'ticket' AND data->>'state' = 'closed') as closed_tickets
      FROM data
    `);

    const totalRecords = parseInt(statsResult.rows[0].total_records);
    const panels = parseInt(statsResult.rows[0].panels);
    const tickets = parseInt(statsResult.rows[0].tickets);
    const openTickets = parseInt(statsResult.rows[0].open_tickets);
    const closedTickets = parseInt(statsResult.rows[0].closed_tickets);

    // Get database size
    const sizeResult = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    const storage = sizeResult.rows[0].size;

    // Get total available storage (disk allocation)
    let totalStorage = 'N/A';
    try {
      // Try to get actual disk space information
      const diskResult = await pool.query(`
        SELECT 
          pg_size_pretty(
            (SELECT sum(pg_database_size(datname))::bigint FROM pg_database) +
            (SELECT sum(pg_tablespace_size(oid))::bigint FROM pg_tablespace)
          ) as total_used,
          pg_size_pretty(
            (SELECT setting::bigint FROM pg_settings WHERE name = 'max_wal_size') * 16 * 1024 * 1024
          ) as wal_size
      `);

      // Try alternative method: get from pg_stat_file (requires superuser on some systems)
      try {
        const fsResult = await pool.query(`
          SELECT 
            (pg_stat_file('base')).size as base_size,
            (pg_stat_file('global')).size as global_size
        `);
        // This won't work on Cloud SQL due to permissions
      } catch (e) {
        // Expected to fail on Cloud SQL
      }

      // For Cloud SQL, query the actual allocated space via pg_ls_waldir and calculate
      const walResult = await pool.query(`
        SELECT 
          COALESCE(sum(size), 0) as wal_size 
        FROM pg_ls_waldir()
      `);

      const allDbSize = await pool.query(`
        SELECT pg_size_pretty(sum(pg_database_size(datname))::bigint) as all_db_size
        FROM pg_database
        WHERE datistemplate = false
      `);

      // Get total space used by all objects
      const totalUsed = await pool.query(`
        SELECT pg_size_pretty(
          (SELECT sum(pg_database_size(datname))::bigint FROM pg_database WHERE datistemplate = false) +
          ${walResult.rows[0].wal_size}
        ) as total_disk_usage
      `);

      totalStorage = totalUsed.rows[0].total_disk_usage || allDbSize.rows[0].all_db_size;

    } catch (e) {
      // Final fallback: sum all database sizes
      try {
        const allDbResult = await pool.query(`
          SELECT pg_size_pretty(sum(pg_database_size(datname))::bigint) as total_size
          FROM pg_database
        `);
        totalStorage = allDbResult.rows[0].total_size;
      } catch (e2) {
        totalStorage = 'Unable to determine';
      }
    }

    // Get database version and info

    const versionResult = await pool.query('SELECT version() as version, current_database() as dbname');
    const fullVersion = versionResult.rows[0].version;
    const dbVersion = fullVersion.split(',')[0].replace('PostgreSQL ', '');
    const dbName = versionResult.rows[0].dbname;


    // Get connection info

    const hostResult = await pool.query(`
      SELECT 
        inet_server_addr() as host, 
        inet_server_port() as port,
        current_setting('max_connections')::int as max_conn
    `);
    const host = hostResult.rows[0].host || 'localhost';
    const port = hostResult.rows[0].port || '5432';
    const maxConnections = hostResult.rows[0].max_conn || 0;



    const activeConnResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    const activeConnections = parseInt(activeConnResult.rows[0].count);


    const responseTime = Date.now() - startTime;

    return {
      connected: true,
      totalRecords,
      panels,
      tickets,
      openTickets,
      closedTickets,
      storage,
      totalStorage,
      host,
      port,
      dbName,
      dbVersion,
      maxConnections,
      activeConnections,
      responseTime
    };
  } catch (error: any) {

    const responseTime = Date.now() - startTime;
    return {
      connected: false,
      totalRecords: 0,
      panels: 0,
      tickets: 0,
      openTickets: 0,
      closedTickets: 0,
      storage: 'N/A',
      totalStorage: 'N/A',
      host: 'N/A',
      port: 'N/A',
      dbName: 'N/A',
      dbVersion: 'N/A',
      maxConnections: 0,
      activeConnections: 0,
      responseTime,
      error: error.message
    };
  }
}


export async function execute(
  interaction: ChatInputCommandInteraction,
  client: BotClient
): Promise<void> {

  await interaction.deferReply();


  // Bot uptime
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);


  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const processMemory = process.memoryUsage();

  const totalMemoryGB = (totalMemory / 1024 / 1024 / 1024).toFixed(2);
  const usedMemoryGB = (usedMemory / 1024 / 1024 / 1024).toFixed(2);
  const freeMemoryGB = (freeMemory / 1024 / 1024 / 1024).toFixed(2);
  const processMemoryMB = (processMemory.rss / 1024 / 1024).toFixed(2);
  const heapUsedMB = (processMemory.heapUsed / 1024 / 1024).toFixed(2);
  const heapTotalMB = (processMemory.heapTotal / 1024 / 1024).toFixed(2);


  // CPU information

  const cpus = os.cpus();
  const cpuModel = cpus[0].model;
  const cpuCores = cpus.length;
  const cpuSpeed = cpus[0].speed;



  const systemUptime = os.uptime();
  const sysDays = Math.floor(systemUptime / 86400);
  const sysHours = Math.floor((systemUptime % 86400) / 3600);
  const sysMinutes = Math.floor((systemUptime % 3600) / 60);



  const platform = `${os.type()} ${os.release()}`;
  const arch = os.arch();
  const hostname = os.hostname();


  let loadAvg = 'N/A';
  try {
    const loads = os.loadavg();
    loadAvg = `${loads[0].toFixed(2)}, ${loads[1].toFixed(2)}, ${loads[2].toFixed(2)}`;

  } catch (e) {

  }

  // Discord statistics

  const guildCount = client.guilds.cache.size;
  const channelCount = client.channels.cache.size;
  const userCount = client.users.cache.size;
  const wsLatency = client.ws.ping;


  // Environment info
  const nodeVersion = process.version;
  const pid = process.pid;
  const execPath = process.execPath;
  const cwd = process.cwd();


  // Database statistics
  const dbStats = await getDatabaseStats(client);


  const networkInterfaces = os.networkInterfaces();
  let primaryIP = 'N/A';
  for (const [name, interfaces] of Object.entries(networkInterfaces)) {
    if (interfaces) {
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          primaryIP = iface.address;

          break;
        }
      }
      if (primaryIP !== 'N/A') break;
    }
  }

  // Build main status embed with vertical layout
  ;
  const statusEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('System Status Dashboard')
    .setDescription('Comprehensive bot and system information')
    .addFields(
      {
        name: 'Bot Information',
        value:
          `${TICK} **Status**: Online & Running\n` +
          `${TICK} **Uptime**: ${days}d ${hours}h ${minutes}m ${seconds}s\n` +
          `${TICK} **Servers**: ${guildCount}\n` +
          `${TICK} **Channels**: ${channelCount}\n` +
          `${TICK} **Users**: ${userCount}\n` +
          `${TICK} **WebSocket Ping**: ${wsLatency}ms\n` +
          `${TICK} **Node.js**: ${nodeVersion}\n` +
          `${TICK} **Discord.js**: v14.14.1\n` +
          `${TICK} **Process ID**: ${pid}`,
        inline: false
      },
      {
        name: 'Server Information',
        value:
          `${TICK} **Platform**: ${platform}\n` +
          `${TICK} **System Uptime**: ${sysDays}d ${sysHours}h ${sysMinutes}m`,
        inline: false
      },
      {
        name: 'CPU & Performance',
        value:
          `${TICK} **CPU Model**: ${cpuModel.substring(0, 50)}${cpuModel.length > 50 ? '...' : ''}\n` +
          `${TICK} **CPU Cores**: ${cpuCores} cores @ ${cpuSpeed}MHz\n` +
          `${TICK} **Load Average**: ${loadAvg}`,
        inline: false
      },
      {
        name: 'Memory Usage',
        value:
          `${TICK} **Total RAM**: ${totalMemoryGB} GB\n` +
          `${TICK} **Used RAM**: ${usedMemoryGB} GB\n` +
          `${TICK} **Free RAM**: ${freeMemoryGB} GB\n` +
          `${TICK} **Process RSS**: ${processMemoryMB} MB\n` +
          `${TICK} **Heap Used**: ${heapUsedMB} MB / ${heapTotalMB} MB\n` +
          `${TICK} **Memory Usage**: ${((usedMemory / totalMemory) * 100).toFixed(1)}%`,
        inline: false
      }
    )
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  // Database embed with vertical layout
  const dbEmbed = new EmbedBuilder()
    .setColor(dbStats.connected ? '#00ff00' : '#ff0000')
    .setTitle('Database Status')
    .setDescription(dbStats.connected ? `${TICK} PostgreSQL Database Connected` : `Database Disconnected`)
    .addFields(
      {
        name: 'Connection Details',
        value: dbStats.connected ?
          `${TICK} **Status**: Connected\n` +
          `${TICK} **Host**: ${dbStats.host}\n` +
          `${TICK} **Port**: ${dbStats.port}\n` +
          `${TICK} **Database**: ${dbStats.dbName}\n` +
          `${TICK} **Version**: ${dbStats.dbVersion}\n` +
          `${TICK} **Response Time**: ${dbStats.responseTime}ms`
          :
          `**Status**: Disconnected\n` +
          `**Error**: ${dbStats.error || 'Unknown error'}`,
        inline: false
      }
    );

  if (dbStats.connected) {
    dbEmbed.addFields(
      {
        name: 'Database Statistics',
        value:
          `${TICK} **Total Records**: ${dbStats.totalRecords}\n` +
          `${TICK} **Configured Panels**: ${dbStats.panels}\n` +
          `${TICK} **Total Tickets**: ${dbStats.tickets}\n` +
          `${TICK} **Open Tickets**: ${dbStats.openTickets}\n` +
          `${TICK} **Closed Tickets**: ${dbStats.closedTickets}\n` +
          `${TICK} **Database Size**: ${dbStats.storage}\n` +
          `${TICK} **Total Available Storage**: ${dbStats.totalStorage}`,
        inline: false
      },
      {
        name: 'Connection Pool',
        value:
          `${TICK} **Active Connections**: ${dbStats.activeConnections}\n` +
          `${TICK} **Max Connections**: ${dbStats.maxConnections}\n` +
          `${TICK} **Pool Usage**: ${((dbStats.activeConnections / dbStats.maxConnections) * 100).toFixed(1)}%`,
        inline: false
      }
    );
  }

  dbEmbed.setTimestamp();

  await interaction.editReply({ embeds: [statusEmbed, dbEmbed] });
}
