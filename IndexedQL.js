var IndexedQL = function(dbName, dbVersion) {
	this.dbname = dbName;
	this.dbversion = parseInt(dbVersion) || 1;
	this.connection = undefined;
	this.tables = { _sys_triggers : "idtrigger" };
	this.indexes = {}
}

IndexedQL.fn = IndexedQL.prototype;

IndexedQL.fn.preparetable = function(tableName, primaryKey) {
	if(!primaryKey)
		primaryKey = "id" + tableName;
	var o = { tname: tableName, primarykey: primaryKey };
	this.tables[tableName] = primaryKey;
	return o;
}

IndexedQL.fn.canceltable = function(tableName) {
	if(this.tables.hasOwnProperty(tableName)) {
		delete this.tables[tableName];
		return true;
	}
	return false;
}

IndexedQL.fn.close = function() {
	if(this.isConnected()) {
		this.connection.close();
		this.connection = undefined;
		this.tables = {};
		this.indexes = {};
		return true;
	}
	console.error("IndexedQL: There is no active connection");
	return false;
}

IndexedQL.fn.dropdb = function(callback) {
	if(this.isConnected()) {
		this.close();
		var ondelete = indexedDB.deleteDatabase(this.idbName);
		var _self = this;
		ondelete.onsuccess = function(e) {
			console.info("IndexedQL: Database " + _self.dbname + " was deleted");
			_self.dbname = undefined;
			_self.dbversion = undefined;
			if(typeof callback == "function")
				callback(e);
		}
		
		ondelete.onerror = function(e) {
			console.info("IndexedQL: Couldn't delete " + _self.dbname + " database");
		}
		return true;
	}
	console.error("IndexedQL: There is no active connection");
	return false;
}

IndexedQL.fn.isConnected = function() {
	if(this.connection)
		return true;
	return false;
}

IndexedQL.fn.connect = function(onready, onupgradeneeded) {
	var _self = this;
	if(this.dbname && this.dbversion) {
		var r = indexedDB.open(this.dbname, this.dbversion);		
		r.onupgradeneeded = function(event) {
			_self.connection = event.target.result;
			var objStore = undefined;
			for(var table in _self.tables) {
				objStore = _self.connection.createObjectStore(table, { keyPath: _self.tables[table], autoIncrement: true });
				if(_self.indexes.hasOwnProperty(table)) {
					var index = _self.indexes[table];
					objStore.createIndex( index.name, index.name, { unique: index.unique });
				}
			}
			
			if(typeof onupgradeneeded == "function")
				onupgradeneeded(event);
		}
		
		r.onsuccess = function(event) {
			_self.connection = event.target.result;
			if(typeof onready == "function")
				onready(event);
		}
	} else
		console.error("IndexedQL: Undefined DBNAME or DBVERSION");
}

IndexedQL.fn.transaction = function(tableName, mode) {
	if(this.isConnected())
		return this.connection.transaction([tableName], mode).objectStore(tableName);
	console.error("IndexedQL: There is no active connection");
	return false;
}

IndexedQL.fn.insert = function(o) {
	if(this.isConnected()) {
		return new (function(o, _self) {
			this.into = function(tableName, callback) {
				var trans = _self.transaction(tableName, "readwrite");
				trans.put(o);
				trans.onsuccess = function() {
					if(typeof callback == "function")
						callback(o);
				}
				
				trans.onerror = function() {
					console.error("IndexedQL: Couldn't insert object " + JSON.stringify(o));
				}
			}
		})(o, this);
	}
	console.error("IndexedQL: There is no active connection");
	return false;
}

IndexedQL.fn.select = function() {
	if(this.isConnected()) {
		return new (function(_self) {
			this.from = function(tableName, callback) {
				var trans = _self.transaction(tableName, "readonly");
				var data = new Array();
				trans.openCursor().onsuccess = function(e) {
					var cursor = e.target.result;
					if(cursor) {
						data.push(cursor.value);
						cursor.continue();
					} else {
						i++;
						if(typeof callback == "function")
							callback(data);
					}
				}
			}
		})(this);
	}
	console.error("IndexedQL: There is no active connection");
	return false;
}

IndexedQL.fn.tableexists = function(tableName) {
	if(this.isConnected())
		return this.connection.objectStoreNames.contains(tableName);
	
	console.error('IndexedQL: There is no active connection');
	return false;
}